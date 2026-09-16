import { init, killThreads } from "z3-solver";
import type { ConstraintProblem } from "./parser";
export type ExactResult = {
  result: "satisfiable" | "unsatisfiable" | "unknown";
  latencyMs: number;
  reason?: string;
};
let runtime: ReturnType<typeof init> | undefined;
let queue: Promise<unknown> = Promise.resolve();
let pending = 0;
/** Z3's asynchronous WASM operations must be serialized within each process. */
export async function solveExact(
  problem: ConstraintProblem,
): Promise<ExactResult> {
  if (pending >= 8)
    return {
      result: "unknown",
      latencyMs: 0,
      reason: "Exact solver is busy; retry shortly.",
    };
  pending++;
  const started = performance.now();
  const task = queue.then(async () => {
    const api = await (runtime ??= init());
    const context = new api.Context("playground");
    const solver = new context.Solver();
    try {
      solver.set("timeout", 3000);
      solver.set("rlimit", 1000000);
      solver.fromString(problem.smt);
      const answer = await solver.check();
      return {
        result:
          answer === "sat"
            ? ("satisfiable" as const)
            : answer === "unsat"
              ? ("unsatisfiable" as const)
              : ("unknown" as const),
        latencyMs: performance.now() - started,
        ...(answer === "unknown" ? { reason: solver.reasonUnknown() } : {}),
      };
    } finally {
      solver.release();
    }
  });
  queue = task.catch(() => {});
  try {
    return await task;
  } catch {
    return {
      result: "unknown",
      latencyMs: performance.now() - started,
      reason: "Exact solver could not complete this check.",
    };
  } finally {
    pending--;
  }
}
export async function shutdownSolver() {
  await queue;
  if (runtime) {
    const r = await runtime;
    await killThreads(r.em);
    runtime = undefined;
  }
}
