import {
  LABELS,
  type Classification,
  type RoutedReview,
  type Thresholds,
} from "./types";
export const DEFAULT_THRESHOLDS: Thresholds = {
  safe: 0.95,
  risk: 0.85,
  minimum: 0.65,
};
export function validateThresholds(thresholds: Thresholds) {
  if (
    Object.values(thresholds).length !== 3 ||
    Object.values(thresholds).some(
      (n) => !Number.isFinite(n) || n < 0.5 || n > 1,
    ) ||
    thresholds.minimum > thresholds.safe ||
    thresholds.minimum > thresholds.risk
  )
    throw Error(
      "Thresholds must be 0.50–1.00, with minimum confidence no greater than safe or high-risk thresholds.",
    );
}
export function routeForReview(
  result: Classification,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): RoutedReview {
  validateThresholds(thresholds);
  const routed = (
    route: RoutedReview["route"],
    risk: RoutedReview["risk"],
    reason: string,
    decision: RoutedReview["decision"] = "needs_review",
  ): RoutedReview => ({ result, route, risk, reason, decision });
  if (
    result.error ||
    !result.hunk.complete ||
    result.decisions.length !== LABELS.length ||
    !LABELS.every((label) => result.decisions.some((d) => d.label === label))
  )
    return routed(
      "human",
      "unknown",
      result.error || result.hunk.issue || "Classification is incomplete.",
    );
  const selected = result.decisions.filter((d) => d.selected === d.label);
  const highRisk = selected.some((d) =>
    ["security_risk", "breaking_api_change"].includes(d.label),
  );
  if (
    selected.some(
      (d) =>
        ["security_risk", "breaking_api_change"].includes(d.label) &&
        (d.certainty ?? 0) >= thresholds.risk,
    )
  )
    return routed(
      "human",
      "high",
      "High-confidence security or API risk; candidate block requires human confirmation.",
      "block_candidate",
    );
  if (result.candidates.protected)
    return routed(
      "human",
      highRisk ? "high" : "medium",
      "A protected-path rule requires human review.",
    );
  const all = [...result.decisions, result.rule];
  if (
    all.some(
      (d) =>
        d.selected === "unknown" ||
        d.selected === "needs_human_review" ||
        d.certainty === null,
    )
  )
    return routed(
      "human",
      highRisk ? "high" : "unknown",
      "Unknown, human-review, or unscored decision.",
    );
  const safe = selected.some((d) =>
    ["safe_change", "generated_or_vendor_code"].includes(d.label),
  );
  const risk = selected.some((d) =>
    [
      "possible_bug",
      "missing_test",
      "security_risk",
      "breaking_api_change",
    ].includes(d.label),
  );
  if (safe && risk)
    return routed(
      "human",
      highRisk ? "high" : "medium",
      "Safe/generated and risk labels conflict; retain both for review.",
    );
  if (highRisk)
    return routed(
      "human",
      "high",
      "Potential security or API risk needs human review.",
    );
  if (!selected.length)
    return routed("human", "unknown", "No positive label selected.");
  if (
    safe &&
    !risk &&
    !result.candidates.testsRequired &&
    all.every((d) => (d.certainty ?? 0) >= thresholds.safe)
  )
    return routed(
      "skip",
      "low",
      "All decisions meet the safe threshold; no expensive review suggested.",
      "approve_candidate",
    );
  if (result.candidates.testsRequired)
    return routed(
      "human",
      "medium",
      "A test requirement applies; a reviewer must verify corresponding coverage.",
    );
  if (all.some((d) => (d.certainty ?? 0) < thresholds.minimum))
    return routed(
      "llm",
      "unknown",
      "Low-confidence classification; queue for contextual review.",
    );
  return routed(
    "llm",
    risk ? "medium" : "unknown",
    "Risk label or insufficient certainty for the safe gate.",
  );
}
export function aggregateReviewResults(
  results: RoutedReview[],
  expectedCount = results.length,
) {
  const counts = { skip: 0, llm: 0, human: 0 };
  results.forEach((result) => counts[result.route]++);
  const pending = Math.max(0, expectedCount - results.length);
  const decision = results.some((r) => r.decision === "block_candidate")
    ? "block_candidate"
    : results.length > 0 &&
        !pending &&
        results.every((r) => r.decision === "approve_candidate")
      ? "approve_candidate"
      : "needs_review";
  return {
    decision,
    counts,
    pending,
    reviewed: results.length,
    total: expectedCount,
  };
}
