import type { GovernanceAnalysis } from "../types/governance";
import type { GovernanceDecision } from "../types/review";
import { buildGovernanceUnits } from "./classifyWithJev";
export function resolveReviewStatus(
  a: GovernanceAnalysis,
  decisions: GovernanceDecision[],
  threshold = 0.85,
) {
  if (!Number.isFinite(threshold) || threshold < 0.5 || threshold > 1)
    throw Error("Confidence threshold must be 0.50–1.00.");
  if (a.checks.blocked)
    return {
      status: "block_candidate" as const,
      reason:
        "A deterministic secrets rule blocks this candidate. No Jev classification is requested.",
    };
  if (a.checks.findings.some((f) => f.severity === "review"))
    return {
      status: "needs_review" as const,
      reason:
        "Deterministic policy or context findings require review and cannot be downgraded by Jev.",
    };
  const units = buildGovernanceUnits(a);
  if (
    units.some((u) => !decisions.some((d) => d.unit.id === u.id)) ||
    decisions.some(
      (d) =>
        d.error ||
        d.outcome !== "safe_change" ||
        d.confidence === null ||
        d.probability === null ||
        Math.min(d.confidence, d.probability) < threshold,
    )
  )
    return {
      status: "needs_review" as const,
      reason:
        "A non-safe, low-confidence, missing, or failed classification needs human review.",
    };
  return {
    status: "merge_candidate" as const,
    reason:
      "No blocking or review finding within this supplied mock snapshot. Normal repository approval still applies.",
  };
}
