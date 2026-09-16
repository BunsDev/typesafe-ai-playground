import type { GovernanceAnalysis } from "../types/governance";
import type { VerifiedRun } from "../types/ast";
import type { TestCacheResult } from "../types/review";
import { hashStructured } from "./buildSymbolGraph";
async function snapshot(a: GovernanceAnalysis) {
  const symbolHashes = Object.fromEntries(
    a.graph.nodes
      .filter((n) => a.graph.relevantIds.includes(n.id))
      .map((n) => [n.id, n.hash || ""])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  const tests = [...a.impact.testScope].sort();
  const environmentHash = a.manifest.environmentHash;
  return {
    symbolHashes,
    tests,
    environmentHash,
    fingerprint: await hashStructured({
      version: "mock-analysis-v1",
      symbolHashes,
      tests,
      environmentHash,
      policies: a.policies,
      diff: a.pr.diff,
      edges: a.graph.edges,
    }),
  };
}
export async function createMockVerifiedRun(
  a: GovernanceAnalysis,
): Promise<VerifiedRun> {
  if (
    a.checks.blocked ||
    !a.graph.complete ||
    !a.impact.testScope.length ||
    !a.manifest.environmentHash
  )
    throw Error(
      "A complete mock graph, test scope, and environment hash are required for a simulated verified snapshot.",
    );
  return { simulated: true, verified: true, ...(await snapshot(a)) };
}
export async function testCache(
  a: GovernanceAnalysis,
  prior: VerifiedRun | undefined = a.manifest.priorVerifiedRun,
): Promise<TestCacheResult> {
  const scope = a.impact.testScope;
  if (
    a.checks.blocked ||
    !a.graph.complete ||
    !scope.length ||
    !a.manifest.environmentHash
  )
    return {
      action: "needs_human_confirmation",
      reason:
        "Blocked or incomplete dependency/test/environment evidence cannot justify skipping tests.",
      scope,
    };
  const current = await snapshot(a);
  if (
    prior?.verified === true &&
    prior.simulated === true &&
    prior.fingerprint === current.fingerprint &&
    JSON.stringify(prior.symbolHashes) ===
      JSON.stringify(current.symbolHashes) &&
    JSON.stringify(prior.tests) === JSON.stringify(current.tests) &&
    prior.environmentHash === current.environmentHash
  )
    return {
      action: "skip_tests",
      reason:
        "Simulation: changed-symbol and dependency hashes, policy, environment, and test scope match a prior simulated verified run. No real tests have run or been skipped.",
      scope,
    };
  return {
    action: "rerun_tests",
    reason:
      "Simulation: no matching verified snapshot. Rerun the manifest-listed test scope; this app does not execute it.",
    scope,
  };
}
