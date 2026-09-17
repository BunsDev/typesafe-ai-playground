import type {
  AgentState,
  CycleLog,
  Decision,
  OutcomeKind,
  PageSnapshot,
  VerificationReport,
} from "../types/browserAgent";
import { formatElementTable } from "./getElementTable";
/**
 * Per-cycle logging: the element table Jev saw, the operation and target it
 * chose with confidence, and what actually happened. A run that degrades can
 * then be separated from a run that was fed a bad state.
 */
export const LOG_LIMIT = 200;
export function startCycle(
  step: number,
  startedMs: number,
  page: PageSnapshot,
): CycleLog {
  return {
    step,
    startedMs,
    elapsedMs: 0,
    elementTable: formatElementTable(page.elements),
    visibleText: page.text,
    operation: null,
    target: null,
    targetLabel: null,
    confidence: null,
    targetConfidence: null,
    operationProbabilities: {},
    targetProbabilities: {},
    speculativeHeads: [],
    jevLatencyMs: 0,
    text: null,
    textHelper: null,
    textLatencyMs: 0,
    outcome: "error",
    detail: "",
    pageChanged: null,
    verification: null,
  };
}
export function recordDecision(entry: CycleLog, decision: Decision): CycleLog {
  return {
    ...entry,
    operation: decision.operation,
    target: decision.target,
    targetLabel: decision.action?.label ?? null,
    confidence: decision.confidence,
    targetConfidence: decision.targetConfidence,
    operationProbabilities: decision.operationProbabilities,
    targetProbabilities: decision.targetProbabilities,
    speculativeHeads: decision.speculativeHeads,
    jevLatencyMs: Math.round(decision.latencyMs),
  };
}
export function finishCycle(
  entry: CycleLog,
  outcome: OutcomeKind,
  detail: string,
  elapsedMs: number,
  extra: Partial<
    Pick<
      CycleLog,
      "pageChanged" | "verification" | "text" | "textHelper" | "textLatencyMs"
    >
  > = {},
): CycleLog {
  return {
    ...entry,
    outcome,
    detail,
    elapsedMs: Math.round(elapsedMs),
    ...extra,
  };
}
/** Appends one entry and keeps the log bounded. */
export const logStep = (log: CycleLog[], entry: CycleLog) =>
  [...log, entry].slice(-LOG_LIMIT);
export const outcomeLabels: Record<OutcomeKind, string> = {
  executed: "Executed",
  rejected: "Target rejected",
  stale: "Stale decision",
  text_missing: "No text to type",
  done_verified: "Done · verified",
  done_rejected: "Done · rejected by verifier",
  blocked: "Blocked",
  error: "Error",
};
/** Outcomes that mean the cycle escalated instead of acting. */
export const isEscalation = (outcome: OutcomeKind) =>
  outcome !== "executed" && outcome !== "done_verified";
export function describeCycle(entry: CycleLog): string {
  const choice = entry.operation
    ? entry.target
      ? `${entry.operation} [${entry.target}] ${entry.targetLabel ?? ""}`
      : entry.operation
    : "no decision";
  return `${choice} → ${outcomeLabels[entry.outcome]}${entry.detail ? `: ${entry.detail}` : ""}`;
}
/** What Export downloads: the whole run, with no keys or prompts beyond the goal. */
export function exportRun(
  state: AgentState,
  verification: VerificationReport | null,
) {
  return {
    goal: state.goal,
    status: state.status,
    reason: state.reason,
    elapsedMs: state.elapsedMs,
    decisions: state.decisions,
    actions: state.actions,
    rejections: state.rejections,
    textCalls: state.textCalls,
    verification,
    history: state.history,
    log: state.log,
  };
}
