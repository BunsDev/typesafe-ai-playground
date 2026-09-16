import type { RunPayload } from "../../lib/api";
export const LABELS = [
  "safe_change",
  "possible_bug",
  "missing_test",
  "security_risk",
  "breaking_api_change",
  "generated_or_vendor_code",
  "needs_human_review",
] as const;
export type Label = (typeof LABELS)[number];
export interface RepoRule {
  id: string;
  kind: "protected_path" | "test_requirement" | "security" | "style";
  path: string;
  text: string;
}
export interface Hunk {
  id: string;
  path: string;
  previousPath?: string;
  header: string;
  diff: string;
  oldStart: number;
  newStart: number;
  complete: boolean;
  issue?: string;
}
export interface ChangedFile {
  path: string;
  previousPath?: string;
  hunks: Hunk[];
}
export interface PullRequestInput {
  diff: string;
  title?: string;
  description?: string;
  url?: string;
  headSha?: string;
  baseSha?: string;
}
export interface ParsedPullRequest extends PullRequestInput {
  title: string;
  description: string;
  files: ChangedFile[];
}
export interface Candidates {
  labels: Record<Label, string>;
  rules: Record<string, string>;
  protected: boolean;
  testsRequired: boolean;
}
export interface Decision {
  selected: string;
  confidence: number | null;
  probability: number | null;
  certainty: number | null;
}
export interface Classification {
  hunk: Hunk;
  candidates: Candidates;
  decisions: (Decision & { label: Label })[];
  rule: Decision;
  source: "jev" | "mock" | "unclassified";
  error?: string;
}
export interface Thresholds {
  safe: number;
  risk: number;
  minimum: number;
}
export interface RoutedReview {
  result: Classification;
  route: "skip" | "llm" | "human";
  risk: "low" | "medium" | "high" | "unknown";
  decision: "approve_candidate" | "needs_review" | "block_candidate";
  reason: string;
}
export type JevTransport = (
  payload: RunPayload,
  signal?: AbortSignal,
) => Promise<unknown>;
