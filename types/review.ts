export const REVIEW_OUTCOMES = [
  "safe_change",
  "possible_breaking_change",
  "missing_test_coverage",
  "security_or_policy_risk",
  "needs_human_review",
  "needs_more_context",
] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];
export type ReviewUnit = {
  id: string;
  hunkId: string;
  filePath: string;
  symbolIds: string[];
  focus: "compatibility" | "test_coverage" | "change";
};
export type GovernanceDecision = {
  unit: ReviewUnit;
  outcome: ReviewOutcome;
  confidence: number | null;
  probability: number | null;
  source: "jev" | "mock" | "unclassified";
  error?: string;
};
export type TestCacheResult = {
  action: "rerun_tests" | "skip_tests" | "needs_human_confirmation";
  reason: string;
  scope: string[];
};
