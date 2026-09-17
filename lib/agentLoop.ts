import {
  MAX_ACTIONS,
  MAX_CONSECUTIVE_REJECTIONS,
  MAX_DECISIONS,
  MAX_DONE_REJECTIONS,
  type AgentState,
  type Decision,
  type HistoryEntry,
  type PageSnapshot,
  type TextHelperMode,
  type TextHelperResult,
  type VerificationReport,
} from "../types/browserAgent";
import { executeAction, settleAfter } from "./actions";
import { decideWithJev, type JevTransport } from "./callJev";
import { getElementTable } from "./getElementTable";
import { finishCycle, logStep, recordDecision, startCycle } from "./logStep";
import {
  buildTextContext,
  requestFieldText,
  type TextContext,
} from "./textHelper";
import { isFresh, resolveTarget } from "./validateTarget";
import { errorMessage } from "./client";
/**
 * The complete loop: observe → one Jev round trip → validate → execute →
 * settle → observe. The goal and its verifier come from the task; the policy
 * never sees site-specific scripts or prepared field strings.
 */
export interface AgentDeps {
  doc: Document;
  win: Window;
  goal: string;
  model: string;
  textMode: TextHelperMode;
  /** Independent outcome check. DONE is never trusted on its own. */
  verify: (doc: Document, win: Window) => VerificationReport;
  signal: AbortSignal;
  onUpdate?: (state: LoopState) => void;
  /** Injectable for tests and mock runs. */
  decide?: (
    page: PageSnapshot,
    goal: string,
    history: HistoryEntry[],
    model: string,
    signal: AbortSignal,
  ) => Promise<Decision>;
  fieldText?: (
    context: TextContext,
    signal: AbortSignal,
  ) => Promise<TextHelperResult>;
  transport?: JevTransport;
}
export interface LoopState extends AgentState {
  startedAt: number | null;
  doneRejections: number;
  consecutiveRejections: number;
  consecutiveErrors: number;
  pendingText: { key: string; result: TextHelperResult } | null;
}
export function createAgentState(goal: string): LoopState {
  return {
    status: "ready",
    reason: "",
    goal,
    page: null,
    decision: null,
    history: [],
    log: [],
    verification: null,
    elapsedMs: 0,
    decisions: 0,
    actions: 0,
    rejections: 0,
    textCalls: 0,
    startedAt: null,
    doneRejections: 0,
    consecutiveRejections: 0,
    consecutiveErrors: 0,
    pendingText: null,
  };
}
const now = () => performance.now();
const elapsed = (state: LoopState) =>
  state.startedAt === null ? 0 : now() - state.startedAt;
export function observe(deps: AgentDeps, state: LoopState): LoopState {
  return { ...state, page: getElementTable(deps.doc, deps.win) };
}
const stop = (
  state: LoopState,
  status: LoopState["status"],
  reason: string,
): LoopState => ({ ...state, status, reason, elapsedMs: elapsed(state) });
/** One decision cycle. Returns the next state; never throws for model or page faults. */
export async function agentCycle(
  deps: AgentDeps,
  input: LoopState,
): Promise<LoopState> {
  let state: LoopState = { ...input, status: "running" };
  if (state.startedAt === null) state.startedAt = now();
  if (!state.page || !isFresh(deps.doc, deps.win, state.page))
    state = observe(deps, state);
  const page = state.page!;
  if (state.decisions >= MAX_DECISIONS)
    return stop(
      state,
      "failed",
      `Reached the ${MAX_DECISIONS}-decision budget.`,
    );
  const step = state.log.length + 1;
  let entry = startCycle(step, elapsed(state), page);
  const decide =
    deps.decide ??
    ((p, g, h, m, s) => decideWithJev(p, g, h, m, s, deps.transport));
  let decision: Decision;
  try {
    decision = await decide(
      page,
      state.goal,
      state.history,
      deps.model,
      deps.signal,
    );
  } catch (e) {
    if (deps.signal.aborted) return stop(state, "stopped", "Run stopped.");
    const message = errorMessage(e);
    state = {
      ...state,
      decisions: state.decisions + 1,
      consecutiveErrors: state.consecutiveErrors + 1,
      log: logStep(
        state.log,
        finishCycle(entry, "error", message, elapsed(state)),
      ),
    };
    return state.consecutiveErrors >= 2
      ? stop(state, "failed", `Two consecutive decision failures: ${message}`)
      : { ...state, elapsedMs: elapsed(state) };
  }
  state = {
    ...state,
    decision,
    decisions: state.decisions + 1,
    consecutiveErrors: 0,
  };
  entry = recordDecision(entry, decision);
  const remember = (h: Omit<HistoryEntry, "step">) => {
    state = {
      ...state,
      history: [...state.history, { step: state.history.length + 1, ...h }],
    };
  };
  const finish = (
    outcome: Parameters<typeof finishCycle>[1],
    detail: string,
    extra?: Parameters<typeof finishCycle>[4],
  ) => {
    state = {
      ...state,
      log: logStep(
        state.log,
        finishCycle(entry, outcome, detail, elapsed(state), extra),
      ),
    };
  };
  const reject = (
    outcome: "rejected" | "stale" | "text_missing",
    detail: string,
  ) => {
    state = {
      ...state,
      rejections: state.rejections + 1,
      consecutiveRejections: state.consecutiveRejections + 1,
    };
    if (outcome !== "stale")
      remember({
        action: decision.action?.label ?? decision.operation,
        operation: decision.operation,
        kind: decision.action?.kind ?? "blocked",
        text: null,
        outcome: `rejected: ${detail}`,
        pageChanged: false,
      });
    finish(outcome, detail);
    state = observe(deps, { ...state, decision: null });
    if (state.consecutiveRejections >= MAX_CONSECUTIVE_REJECTIONS)
      return stop(
        state,
        "blocked",
        `${MAX_CONSECUTIVE_REJECTIONS} consecutive decisions could not execute.`,
      );
    return { ...state, elapsedMs: elapsed(state) };
  };
  if (decision.operation === "DONE") {
    if (!isFresh(deps.doc, deps.win, page))
      return reject("stale", "Page changed since the decision. Choose again.");
    const verification = deps.verify(deps.doc, deps.win);
    state = { ...state, verification };
    if (verification.passed) {
      finish("done_verified", verification.summary, { verification });
      remember({
        action: "DONE",
        operation: "DONE",
        kind: "done",
        text: null,
        outcome: "verified",
        pageChanged: false,
      });
      return stop(
        state,
        "done",
        "Goal verified independently of the DONE choice.",
      );
    }
    state = {
      ...state,
      doneRejections: state.doneRejections + 1,
      rejections: state.rejections + 1,
    };
    remember({
      action: "DONE",
      operation: "DONE",
      kind: "done",
      text: null,
      outcome: "rejected: the goal is not verifiably complete",
      pageChanged: false,
    });
    finish("done_rejected", verification.summary, { verification });
    if (state.doneRejections >= MAX_DONE_REJECTIONS)
      return stop(
        state,
        "failed",
        `DONE was rejected ${MAX_DONE_REJECTIONS} times by the verifier.`,
      );
    return { ...state, decision: null, elapsedMs: elapsed(state) };
  }
  if (decision.operation === "BLOCKED") {
    finish(
      "blocked",
      "The policy reported that no supported operation can progress.",
    );
    remember({
      action: "BLOCKED",
      operation: "BLOCKED",
      kind: "blocked",
      text: null,
      outcome: "blocked",
      pageChanged: false,
    });
    return stop(state, "blocked", "Jev chose BLOCKED. Escalate to a person.");
  }
  const action = decision.action;
  if (!action) {
    finish(
      "error",
      `${decision.operation} has no executable candidate on this page.`,
    );
    return { ...state, decision: null, elapsedMs: elapsed(state) };
  }
  if (state.actions >= MAX_ACTIONS) {
    finish("blocked", `Stopped at the ${MAX_ACTIONS}-action budget.`);
    return stop(
      state,
      "blocked",
      `Stopped at the ${MAX_ACTIONS}-action budget.`,
    );
  }
  let text: string | null = null;
  let helper: TextHelperResult | null = null;
  if (action.kind === "fill") {
    if (!isFresh(deps.doc, deps.win, page))
      return reject(
        "stale",
        "Page changed before text generation. Choose again.",
      );
    const context = buildTextContext(state.goal, action, page, state.history);
    const key = JSON.stringify(context);
    if (state.pendingText?.key === key) helper = state.pendingText.result;
    else {
      try {
        helper = await (deps.fieldText
          ? deps.fieldText(context, deps.signal)
          : requestFieldText(
              context,
              deps.textMode,
              deps.model,
              deps.signal,
              deps.transport,
            ));
      } catch (e) {
        if (deps.signal.aborted) return stop(state, "stopped", "Run stopped.");
        state = { ...state, textCalls: state.textCalls + 1 };
        return reject("text_missing", errorMessage(e));
      }
      state = {
        ...state,
        textCalls: state.textCalls + 1,
        pendingText: { key, result: helper },
      };
    }
    entry = {
      ...entry,
      textHelper: helper.helper,
      textLatencyMs: Math.round(helper.latencyMs),
    };
    if (helper.text === null) {
      state = { ...state, pendingText: null };
      return reject(
        "text_missing",
        `The text helper found no value for “${action.label}” in the goal.`,
      );
    }
    text = helper.text;
    entry = { ...entry, text };
  }
  let point = null;
  if (action.kind !== "wait" && action.kind !== "scroll") {
    if (!isFresh(deps.doc, deps.win, page, action))
      return reject(
        "stale",
        "Page changed since this decision. Observe again.",
      );
    const resolved = resolveTarget(deps.doc, deps.win, action);
    if (!resolved.ok) return reject("rejected", resolved.detail);
    point = resolved;
  }
  let executed: string;
  try {
    executed = await executeAction(deps.win, action, point, text, deps.signal);
  } catch (e) {
    finish("error", errorMessage(e));
    return stop(state, "failed", errorMessage(e));
  }
  if (deps.signal.aborted) return stop(state, "stopped", "Run stopped.");
  state = {
    ...state,
    actions: state.actions + 1,
    consecutiveRejections: 0,
    pendingText: null,
  };
  // Record execution before observing: a stale post-action read must not erase the action.
  remember({
    action: action.label,
    operation: decision.operation,
    kind: action.kind,
    text,
    outcome: executed,
    pageChanged: null,
  });
  await settleAfter(deps.doc, deps.win, action, deps.signal);
  const next = getElementTable(deps.doc, deps.win);
  const pageChanged = next.marker !== page.marker;
  const history = state.history.map((h, i) =>
    i === state.history.length - 1 ? { ...h, pageChanged } : h,
  );
  state = { ...state, history, page: next, decision: null };
  finish("executed", executed, { pageChanged });
  const recent = state.history.slice(-3);
  if (
    recent.length === 3 &&
    recent.every(
      (h) =>
        h.pageChanged === false &&
        h.kind !== "wait" &&
        !h.outcome.startsWith("rejected"),
    )
  )
    return stop(
      state,
      "blocked",
      "Three consecutive actions changed nothing on the page.",
    );
  return { ...state, elapsedMs: elapsed(state) };
}
/** Runs cycles until the run finishes, is stopped, or `steps` cycles have run. */
export async function runAgent(
  deps: AgentDeps,
  initial: LoopState,
  steps = Infinity,
): Promise<LoopState> {
  let state = initial;
  for (let i = 0; i < steps; i++) {
    if (deps.signal.aborted) return stop(state, "stopped", "Run stopped.");
    state = await agentCycle(deps, state);
    deps.onUpdate?.(state);
    if (state.status !== "running") return state;
  }
  // Paused by the step limit, not finished: the next call resumes the run.
  return { ...state, status: "ready" };
}
