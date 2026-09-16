import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePayload, readBoundedBody } from "../lib/api";
import { buildMemeRequest, memeSamples } from "../lib/memes";
import { POST } from "../app/api/run/route";
const payload = {
  state: "hello",
  questions: { reply: { type: "noul", instructions: "Should we reply?" } },
};
test("API validates supported types and rejects invalid closed sets", () => {
  assert.equal(validatePayload(payload).model, "jev-latest");
  for (const value of [
    {},
    {
      ...payload,
      questions: {
        x: { type: "choice", instructions: "choose", criteria: { a: "only" } },
      },
    },
    {
      ...payload,
      questions: {
        x: { type: "score", instructions: "score", criteria: ["only"] },
      },
    },
  ])
    assert.throws(() => validatePayload(value));
});
test("bounded body stops oversized streams", async () => {
  await assert.rejects(readBoundedBody(new Blob(["abcdef"]).stream(), 3));
  assert.equal(await readBoundedBody(new Blob(["abc"]).stream(), 3), "abc");
});
test("API rejects cross origin before provider access", async () => {
  const r = await POST(
    new Request("https://demo.test/api/run", {
      method: "POST",
      headers: {
        origin: "https://evil.test",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    }),
  );
  assert.equal(r.status, 403);
});
test("API strips unknown properties and handles prototype names safely", () => {
  const p = validatePayload(
    JSON.parse(
      '{"state":"test","questions":{"__proto__":{"type":"noul","instructions":"test","secret":"no"}}}',
    ),
  );
  assert.equal(Object.keys(p.questions)[0], "__proto__");
  assert.equal(Object.hasOwn(p.questions.__proto__, "secret"), false);
});
test("all meme examples use validated closed sets, never free text", () => {
  for (const sample of memeSamples) {
    const p = validatePayload(buildMemeRequest(sample));
    assert.equal(Object.keys(p.questions).length, 4);
    assert.ok(
      Object.values(p.questions).every(
        (q) => q.type === "choice" || q.type === "noul",
      ),
    );
  }
  assert.throws(() =>
    buildMemeRequest({
      setup: "",
      punchline: "",
      context: "",
      audience: "everyone",
    }),
  );
});
test("same-origin dev host reaches provider; key stays in the authorization header", async () => {
  const original = globalThis.fetch;
  const key = process.env.TYPESAFE_API_KEY;
  process.env.TYPESAFE_API_KEY = "test-server-only-secret";
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.typesafe.ai/v1/systemone");
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer test-server-only-secret",
    );
    assert.ok(!String(init?.body).includes("test-server-only-secret"));
    return Response.json({ answers: { reply: { type: "noul", noul: 0.9 } } });
  };
  try {
    const r = await POST(
      new Request("http://localhost:3001/api/run", {
        method: "POST",
        headers: {
          host: "127.0.0.1:3001",
          origin: "http://127.0.0.1:3001",
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    );
    assert.equal(r.status, 200);
    assert.ok(!(await r.text()).includes("test-server-only-secret"));
  } finally {
    globalThis.fetch = original;
    if (key === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = key;
  }
});
test("blank keys are unconfigured and invalid upstream shapes are rejected", async () => {
  const original = globalThis.fetch;
  const key = process.env.TYPESAFE_API_KEY;
  const makeRequest = () =>
    new Request("https://demo.test/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  try {
    process.env.TYPESAFE_API_KEY = "   ";
    assert.equal((await POST(makeRequest())).status, 503);
    process.env.TYPESAFE_API_KEY = " test-only ";
    for (const value of [null, [], 42, {}, { answers: [] }]) {
      globalThis.fetch = async () => Response.json(value);
      assert.equal((await POST(makeRequest())).status, 502);
    }
  } finally {
    globalThis.fetch = original;
    if (key === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = key;
  }
});
