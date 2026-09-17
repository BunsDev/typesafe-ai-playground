import { test } from "node:test";
import assert from "node:assert/strict";
import { POST, GET, DELETE } from "../app/api/native-browser/route";
import { POST as run } from "../app/api/native-browser/run/route";
const request = (body: unknown, origin = "http://localhost") =>
  new Request(`${origin}/api/native-browser`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
test("native API refuses hosted, cross-site, arbitrary-origin and empty completion requests before spawning a browser", async () => {
  const cases = [
    request({ task: "pc" }, "https://example.test"),
    new Request("http://localhost/api/native-browser", {
      method: "POST",
      headers: { origin: "https://evil.example" },
      body: "{}",
    }),
    request({ task: "arbitrary", goal: "Browse" }),
    request({ task: "newegg", goal: "Browse", url: "http://127.0.0.1:22" }),
    request({
      task: "newegg",
      goal: "Browse",
      expected: { fields: {}, text: [] },
    }),
    request({
      task: "newegg",
      goal: "Browse",
      expected: { fields: {}, text: [7] },
    }),
  ];
  for (const req of cases) assert.equal((await POST(req)).status, 400);
});
test("native run and observation require an existing bound session", async () => {
  assert.equal((await run(request({ id: "missing" }))).status, 400);
  assert.equal(
    GET(new Request("http://localhost/api/native-browser?id=missing")).status,
    400,
  );
  assert.equal(
    DELETE(new Request("https://example.test/api/native-browser?id=missing"))
      .status,
    400,
  );
});
