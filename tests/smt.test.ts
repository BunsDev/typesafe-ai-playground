import { test, after } from "node:test";
import assert from "node:assert/strict";
import { parseConstraints, decomposeProblem } from "../lib/smt/parser";
import { solveExact, shutdownSolver } from "../lib/smt/exact";
import {
  classifyProblem,
  combinePredictions,
  routeComparison,
} from "../lib/smt/classify";
after(shutdownSolver);
test("real Z3 verifies contradictions, boolean values, equality, ordering and scheduling", async () => {
  for (const [text, type, expected] of [
    ["x > 5\nx < 3", "integer", "unsatisfiable"],
    [
      "alice_available = true\nbob_available = true\nmeeting_requires_alice = true\nmeeting_requires_bob = true",
      "boolean",
      "satisfiable",
    ],
    ["x = y\ny = 2\nx != 2", "equality", "unsatisfiable"],
    ["a < b\nb < c\nc < a", "ordering", "unsatisfiable"],
    [
      "a_start = 9\na_end = 11\nb_start = 10\nb_end = 12\n(a_end <= b_start) || (b_end <= a_start)",
      "scheduling",
      "unsatisfiable",
    ],
    ["a = b\nb = true\n!a", "boolean", "unsatisfiable"],
    ["x + 2 = 5\nx > 0", "integer", "satisfiable"],
  ] as const) {
    const r = await solveExact(parseConstraints(text, type));
    assert.equal(r.result, expected, text);
    assert.ok(r.latencyMs >= 0);
  }
});
test("parser rejects executable syntax, mixed sorts, oversized input and unsupported math", () => {
  for (const text of [
    "process.exit()",
    "x > 3; (exit)",
    "x = true\nx > 2",
    "x * y = 3",
    "x / 2 = 3",
    "x > 5 garbage",
    "(".repeat(40) + "x" + ")".repeat(40),
  ])
    assert.throws(() => parseConstraints(text, "integer"), text);
  assert.throws(() => parseConstraints("x > 0\n".repeat(61), "integer"));
});
test("decomposition never separates constraints sharing variables", () => {
  const p = parseConstraints("x > 5\nx < y\ny < 3\nz = 2", "integer");
  const g = decomposeProblem(p);
  assert.deepEqual(
    g.map((g) => g.constraints.length),
    [3, 1],
  );
  assert.equal(g.flatMap((g) => g.constraints).length, 4);
});
test("Jev uses fixed choices, downgrades uncertainty, and exact disagreement wins", async () => {
  const p = parseConstraints("x > 5\nx < 3", "integer");
  let payload: any;
  const result = await classifyProblem(p, async (x) => {
    payload = x;
    return {
      answers: {
        outcome: {
          type: "choice",
          choice: "satisfiable",
          confidence: 0.8,
          probabilities: { satisfiable: 0.99 },
        },
      },
    };
  });
  assert.equal(result.prediction, "needs_decomposition");
  assert.deepEqual(Object.keys(payload.questions.outcome.criteria), [
    "satisfiable",
    "unsatisfiable",
    "needs_decomposition",
    "unknown",
  ]);
  assert.deepEqual(payload.state.problem.constraints, p.constraints);
  assert.equal(
    routeComparison(
      { result: "unsatisfiable", latencyMs: 1 },
      { ...result, prediction: "satisfiable", confidence: 0.99 },
    ).result,
    "unsatisfiable",
  );
  assert.equal(
    routeComparison(
      { result: "unknown", latencyMs: 1 },
      { ...result, prediction: "satisfiable", confidence: 0.99 },
    ).agreement,
    null,
  );
  await assert.rejects(() =>
    classifyProblem(p, async () => ({
      answers: { outcome: { type: "choice", choice: "proof" } },
    })),
  );
  assert.equal(
    combinePredictions([
      { ...result, prediction: "satisfiable", confidence: 0.99 },
      { ...result, prediction: "unknown" },
    ]).prediction,
    "needs_decomposition",
  );
});

test("solver route validates origin and grammar before invoking Z3", async () => {
  const { POST } = await import("../app/api/solve/route");
  const request = (body: unknown, origin = "http://localhost") =>
    new Request("http://localhost/api/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await POST(
        request({ text: "x > 2", type: "integer" }, "https://evil.example"),
      )
    ).status,
    403,
  );
  assert.equal(
    (await POST(request({ text: "(assert false)", type: "integer" }))).status,
    400,
  );
  assert.equal(
    (await POST(request({ text: "x > 0", type: "unsupported" }))).status,
    400,
  );
  const result = await POST(request({ text: "x > 5\nx < 3", type: "integer" }));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).result, "unsatisfiable");
});
