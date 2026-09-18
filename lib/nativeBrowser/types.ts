import type { RunPayload } from "../api";
import type { ProviderUsage } from "../../types/usage";
import type { Operation } from "../../types/browserAgent";
export interface NativeNode {
  id: string;
  role: string;
  label: string;
  value: string;
  kind: "fill" | "select" | "toggle" | "click";
  guard: string;
  group: string;
  options?: { index: number; label: string; value: string }[];
}
export interface NativeSnapshot {
  documentId: string;
  revision: number;
  url: string;
  title: string;
  nodes: NativeNode[];
  text: string[];
  scroll: { y: number; height: number; viewport: number };
  challenge: string | null;
  observationTruncated?: boolean;
}
export type WireNode = Pick<
  NativeNode,
  "id" | "role" | "label" | "value" | "kind" | "options"
>;
export interface NativeDelta {
  kind: "baseline" | "delta";
  documentId: string;
  revision: number;
  navigation: boolean;
  location?: { url: string; title: string };
  added: WireNode[];
  changed: WireNode[];
  removed: string[];
  text: { added: string[]; removed: string[] };
  scroll: NativeSnapshot["scroll"];
  omitted: number;
  observationTruncated?: boolean;
  challenge: string | null;
}
export interface NativeAction {
  operation: Operation;
  target?: string;
  text?: string;
  optionIndex?: number;
  value?: string;
  guard?: string;
  batchable?: boolean;
  documentId: string;
  revision: number;
}
export interface NativeExecution {
  action: NativeAction;
  status: "executed" | "rejected" | "skipped";
  detail: string;
  elapsedMs: number;
  checkedRevision?: number;
}
export interface NativeUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}
export interface NativeVerification {
  fields: Record<string, string>;
  text: string[];
}
export interface NativeTrace {
  cycle: number;
  request: RunPayload;
  response: unknown;
  usage: NativeUsage | null;
  executed: number;
  requestCharacters: number;
  fullStateCharacters: number;
  baselineRequestCharacters?: number;
  providerUsage?: ProviderUsage;
  settled?: boolean;
  latencyMs: number;
  results: NativeExecution[];
  error?: string;
  executionError?: string;
  plannedActions?: NativeAction[];
}
export interface NativeReport {
  goal: string;
  status: "running" | "done" | "blocked" | "failed" | "stopped";
  reason: string;
  traces: NativeTrace[];
  verification: { passed: boolean; summary: string };
  snapshot: NativeSnapshot | null;
  wallclockMs?: number;
}
