import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCandidates,
  sampleCandidates,
  vectorRanking,
} from "../lib/rerank-data";
import { rerankWithJev } from "../lib/rerankWithJev";
import { rerankWithBaseline } from "../lib/rerankWithBaseline";
import { compareRankings } from "../lib/compareRankings";
test("candidate validation bounds IDs, scores and text without interpreting code", () => {
  const data = sampleCandidates();
  assert.equal(data.length, 200);
  assert.equal(new Set(data.map((c) => c.id)).size, 200);
  assert.equal(parseCandidates(JSON.stringify(data)).length, 200);
  assert.throws(
    () => parseCandidates(JSON.stringify([data[0], data[0]])),
    /unique/,
  );
  assert.throws(
    () =>
      parseCandidates(
        JSON.stringify([{ ...data[0], vectorScore: 2 }, data[1]]),
      ),
    /Vector/,
  );
  assert.throws(
    () =>
      parseCandidates(
        JSON.stringify([{ ...data[0], text: "x".repeat(1501) }, data[1]]),
      ),
    /snippet/,
  );
});
test("Jev chunks at ten, caps concurrency at three, preserves all supplied candidates", async () => {
  const candidates = sampleCandidates().slice(0, 41);
  let active = 0,
    max = 0,
    calls = 0;
  const run = await rerankWithJev(
    { query: "authentication", candidates },
    {
      transport: async (p) => {
        active++;
        max = Math.max(max, active);
        calls++;
        const state = p.state as { candidates: typeof candidates };
        assert.ok(state.candidates.length <= 10);
        await new Promise((r) => setTimeout(r, 2));
        active--;
        return {
          answers: Object.fromEntries(
            Object.keys(p.questions).map((k) => [
              k,
              {
                type: "choice",
                choice: "direct",
                confidence: 0.9,
                probabilities: {
                  direct: 0.9,
                  relevant: 0.1,
                  tangential: 0,
                  irrelevant: 0,
                  unknown: 0,
                },
              },
            ]),
          ),
        };
      },
    },
  );
  assert.equal(calls, 5);
  assert.equal(max, 3);
  assert.equal(run.candidates.length, 41);
  assert.equal(run.requests, 5);
  assert.deepEqual(
    new Set(run.candidates.map((c) => c.id)),
    new Set(candidates.map((c) => c.id)),
  );
  assert.ok(
    run.candidates.every((c) => Math.abs(c.score! - 0.9666666667) < 0.00001),
  );
});
test("unknown, malformed answers and failed batches do not silently earn relevance", async () => {
  const candidates = sampleCandidates().slice(0, 20);
  let calls = 0;
  const run = await rerankWithJev(
    { query: "auth", candidates },
    {
      transport: async () => {
        if (++calls === 2) throw Error("Rate limit");
        return {
          answers: {
            candidate_0: {
              type: "choice",
              choice: "unknown",
              confidence: 0.9,
              probabilities: { unknown: 0.9 },
            },
            candidate_1: {
              type: "choice",
              choice: "invented",
              confidence: 1,
              probabilities: { invented: 1 },
            },
          },
        };
      },
    },
  );
  assert.ok(run.candidates.every((c) => c.score === null));
  assert.equal(
    compareRankings(run, rerankWithBaseline({ query: "auth", candidates })),
    null,
  );
});
test("rank metrics use actual shared candidates and detect reversed ordering", () => {
  const a = vectorRanking(sampleCandidates().slice(0, 20));
  const b = { ...a, candidates: [...a.candidates].reverse() };
  assert.equal(compareRankings(a, a)?.correlation, 1);
  assert.equal(compareRankings(a, b)?.correlation, -1);
  assert.equal(compareRankings(a, b)?.overlap, 0);
  assert.ok(compareRankings(a, b)!.disagreements.length > 0);
  assert.equal(
    compareRankings(a, { ...b, candidates: b.candidates.slice(1) }),
    null,
  );
});
test("cancellation stops queued rerank batches", async () => {
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    rerankWithJev(
      { query: "auth", candidates: sampleCandidates() },
      {
        signal: c.signal,
        transport: async () => {
          throw Error("Must not call");
        },
      },
    ),
    /Stopped/,
  );
});
