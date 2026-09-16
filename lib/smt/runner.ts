import {
  classifyProblem,
  combinePredictions,
  routeComparison,
  type JevPrediction,
} from "./classify";
import {
  decomposeProblem,
  parseConstraints,
  type ConstraintType,
} from "./parser";
import type { ExactResult } from "./exact";
export type SolverRun = Awaited<ReturnType<typeof runSolverCheck>>;
export async function runSolverCheck(
  text: string,
  type: ConstraintType,
  decompose: boolean,
  proof: boolean,
  signal: AbortSignal,
  onProgress?: (s: string) => void,
) {
  const problem = parseConstraints(text, type);
  const groups = decompose ? decomposeProblem(problem) : [problem];
  const predictions: JevPrediction[] = Array(groups.length);
  let cursor = 0,
    complete = 0;
  const start = performance.now();
  await Promise.all(
    Array.from({ length: Math.min(3, groups.length) }, async () => {
      while (cursor < groups.length) {
        const index = cursor++;
        if (signal.aborted) throw signal.reason;
        try {
          predictions[index] = await classifyProblem(
            groups[index],
            undefined,
            signal,
          );
        } catch (e) {
          if (signal.aborted) throw e;
          predictions[index] = {
            prediction: "unknown",
            confidence: null,
            latencyMs: 0,
            error: e instanceof Error ? e.message : "Jev unavailable",
          };
        }
        onProgress?.(
          `Classified ${++complete}/${groups.length} independent groups`,
        );
      }
    }),
  );
  const jev =
    groups.length === 1 ? predictions[0] : combinePredictions(predictions);
  jev.latencyMs = performance.now() - start;
  onProgress?.(
    jev.prediction === "unsatisfiable"
      ? "Prioritizing exact verification of the predicted contradiction…"
      : "Verifying the full constraint set with Z3…",
  );
  const exactStart = performance.now();
  let exact: ExactResult;
  try {
    const response = await fetch("/api/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, type }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
    });
    const raw = await response.json();
    if (!response.ok) throw Error(raw.error || "Exact solver unavailable.");
    if (
      !["satisfiable", "unsatisfiable", "unknown"].includes(raw.result) ||
      typeof raw.latencyMs !== "number" ||
      !Number.isFinite(raw.latencyMs) ||
      raw.latencyMs < 0
    )
      throw Error("Invalid exact solver response.");
    exact = raw;
  } catch (e) {
    if (signal.aborted) throw e;
    exact = {
      result: "unknown",
      latencyMs: performance.now() - exactStart,
      reason: e instanceof Error ? e.message : "Exact solver unavailable.",
    };
  }
  return {
    problem,
    groups: groups.map((p, i) => ({ problem: p, prediction: predictions[i] })),
    jev,
    exact,
    exactRoundTripMs: performance.now() - exactStart,
    routing: routeComparison(exact, jev, proof),
  };
}
