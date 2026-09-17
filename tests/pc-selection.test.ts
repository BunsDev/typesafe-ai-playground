import { test } from "node:test";
import assert from "node:assert/strict";
import { PART_SEARCHES, type PartCandidate } from "../lib/neweggResearch";
import { selectPcBuild } from "../lib/pcSelection";
const candidates = Object.keys(PART_SEARCHES).flatMap((category, i) =>
  [0, 1].map(
    (j) =>
      ({
        id: `P${i * 2 + j + 1}`,
        category,
        title: `${category} option ${j}`,
        priceCents: j ? 40000 : 20000,
        shipping: "free",
        url: `https://www.newegg.com/p/P${i * 2 + j + 1}`,
      }) as PartCandidate,
  ),
);
test("Jev closed choices produce eight budget-safe parts without a text model", async () => {
  const exchanges: unknown[] = [];
  const build = await selectPcBuild(
    candidates,
    "1440p PC for $2500",
    AbortSignal.timeout(1000),
    exchanges,
    async (payload) => ({
      answers: Object.fromEntries(
        Object.keys(payload.questions).map((key, i) => [
          key,
          {
            choice: `P${i * 2 + 2}`,
            probabilities: { [`P${i * 2 + 1}`]: 0.1, [`P${i * 2 + 2}`]: 0.9 },
          },
        ]),
      ),
    }),
  );
  assert.equal(build.parts.length, 8);
  assert.equal(new Set(build.parts.map((p) => p.category)).size, 8);
  assert.equal(build.totalCents, 240000);
  assert.equal(exchanges.length, 1);
});
test("unsupported model IDs fail closed instead of fabricating parts", async () => {
  await assert.rejects(
    selectPcBuild(
      candidates,
      "PC",
      AbortSignal.timeout(1000),
      [],
      async (payload) => ({
        answers: Object.fromEntries(
          Object.keys(payload.questions).map((key) => [
            key,
            { choice: "INJECTED" },
          ]),
        ),
      }),
    ),
    /invalid.*choice/i,
  );
});
test("impossible budget fails before a model call", async () => {
  await assert.rejects(
    selectPcBuild(
      candidates.map((p) => ({ ...p, priceCents: 40000 })),
      "PC",
      AbortSignal.timeout(1000),
      [],
      async () => {
        throw Error("Must not call");
      },
    ),
    /budget/i,
  );
});

test("billing refusal retains evidence and produces a local observed-price baseline", async () => {
  const { JevProviderError } = await import("../lib/serverJev");
  const exchanges: import("../lib/pcSelection").SelectionExchange[] = [];
  const build = await selectPcBuild(
    candidates,
    "1440p PC for $2500",
    AbortSignal.timeout(1000),
    exchanges,
    async () => {
      throw new JevProviderError("Provider billing refused", 402, {
        attempted: true,
        status: 402,
        inputTokens: null,
        outputTokens: null,
        retryAt: null,
      });
    },
  );
  assert.equal(build.selectionMethod, "local-budget-baseline");
  assert.equal(build.parts.length, 8);
  assert.equal(build.totalCents, 160000);
  assert.equal(exchanges[0].providerUsage?.status, 402);
  assert.equal(exchanges[0].response, null);
  assert.match(build.warnings.join(" "), /Jev.*402/);
  assert.ok(build.parts.every((p) => candidates.some((c) => c.id === p.id)));
});
