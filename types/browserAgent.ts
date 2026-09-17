import type { RunPayload } from "../lib/api";
/** The fixed operation set, matching browser-use/jev-ultrafast. */
export const operations = [
  "CLICK",
  "TYPE_TEXT",
  "SELECT",
  "SCROLL_UP",
  "SCROLL_DOWN",
  "WAIT",
  "DONE",
  "BLOCKED",
] as const;
export type Operation = (typeof operations)[number];
export const isOperation = (value: unknown): value is Operation =>
  typeof value === "string" &&
  (operations as readonly string[]).includes(value);
/** Operations that need a target head; the others are page-level controls. */
export type TargetOperation = "CLICK" | "TYPE_TEXT" | "SELECT";
export const targetHeads: Record<TargetOperation, string> = {
  CLICK: "click_target",
  TYPE_TEXT: "type_text_target",
  SELECT: "select_target",
};
export type ElementRole =
  | "button"
  | "link"
  | "checkbox"
  | "radio"
  | "switch"
  | "tab"
  | "menuitem"
  | "menuitemradio"
  | "option"
  | "gridcell"
  | "combobox"
  | "textbox"
  | "searchbox"
  | "spinbutton";
export interface SelectOption {
  /** `element:option` — the executor owns this index, the model only picks it. */
  index: string;
  label: string;
  value: string;
}
/** One row of the indexed element table Jev reads. */
export interface ElementRecord {
  index: string;
  role: ElementRole;
  label: string;
  value: string;
  operations: TargetOperation[];
  checked?: string;
  selected?: string;
  expanded?: string;
  options?: SelectOption[];
}
export type ActionKind = "click" | "fill" | "select" | "scroll" | "wait";
/** An executable candidate. `node` is a code-owned identity, never a selector. */
export interface ActionCandidate {
  id: string;
  kind: ActionKind;
  label: string;
  /** Element index (`3`) or element:option index (`3:2`) in the table. */
  index?: string;
  node?: number;
  role?: ElementRole;
  value?: string;
  currentValue?: string;
  optionIndex?: number;
  checked?: string;
  selected?: string;
  expanded?: string;
  delta?: number;
}
export interface PageSnapshot {
  url: string;
  title: string;
  text: string;
  width: number;
  height: number;
  scroll: { y: number; height: number };
  elements: ElementRecord[];
  actions: ActionCandidate[];
  /** Full semantic marker: any change means the decision is stale. */
  marker: string;
  /** Form/viewport key, compared before clicks together with the target guard. */
  pageKey: string;
  guards: Record<string, string>;
  omitted: number;
  observedAt: number;
}
export interface HistoryEntry {
  step: number;
  action: string;
  operation: Operation;
  kind: ActionKind | "done" | "blocked";
  text: string | null;
  outcome: string;
  pageChanged: boolean | null;
}
export interface Decision {
  operation: Operation;
  target: string | null;
  action: ActionCandidate | null;
  confidence: number | null;
  targetConfidence: number | null;
  operationProbabilities: Record<string, number>;
  targetProbabilities: Record<string, number>;
  latencyMs: number;
  /** Heads that were requested in the same round trip and then discarded. */
  speculativeHeads: string[];
  request: RunPayload;
  response: unknown;
  usage: { inputTokens: number | null; outputTokens: number | null } | null;
}
export type TextHelperMode = "auto" | "llm" | "jev-span";
export interface TextHelperResult {
  text: string | null;
  helper: string;
  latencyMs: number;
  raw: string;
}
export type OutcomeKind =
  | "executed"
  | "rejected"
  | "stale"
  | "text_missing"
  | "done_verified"
  | "done_rejected"
  | "blocked"
  | "error";
export interface VerificationReport {
  passed: boolean;
  checks: Record<string, boolean>;
  summary: string;
}
/** Everything recorded per decision cycle, for debugging degradation vs. bad state. */
export interface CycleLog {
  step: number;
  startedMs: number;
  elapsedMs: number;
  elementTable: string[];
  visibleText: string;
  observation: Pick<
    PageSnapshot,
    | "url"
    | "title"
    | "width"
    | "height"
    | "scroll"
    | "marker"
    | "pageKey"
    | "omitted"
  >;
  request: RunPayload | null;
  response: unknown;
  usage: Decision["usage"];
  textMode: TextHelperMode | null;
  textContext: unknown;
  textResult: TextHelperResult | null;
  operation: Operation | null;
  target: string | null;
  targetLabel: string | null;
  confidence: number | null;
  targetConfidence: number | null;
  operationProbabilities: Record<string, number>;
  targetProbabilities: Record<string, number>;
  speculativeHeads: string[];
  jevLatencyMs: number;
  text: string | null;
  textHelper: string | null;
  textLatencyMs: number;
  outcome: OutcomeKind;
  detail: string;
  pageChanged: boolean | null;
  verification: VerificationReport | null;
}
export type AgentStatus =
  "ready" | "running" | "done" | "blocked" | "failed" | "stopped";
export interface AgentState {
  status: AgentStatus;
  reason: string;
  goal: string;
  page: PageSnapshot | null;
  decision: Decision | null;
  history: HistoryEntry[];
  log: CycleLog[];
  verification: VerificationReport | null;
  elapsedMs: number;
  decisions: number;
  actions: number;
  rejections: number;
  textCalls: number;
}
export const MAX_ACTIONS = 40;
export const MAX_DECISIONS = 80;
export const MAX_DONE_REJECTIONS = 3;
export const MAX_CONSECUTIVE_REJECTIONS = 4;
