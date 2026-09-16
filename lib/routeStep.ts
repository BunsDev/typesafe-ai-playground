import type {
  RouterState,
  RoutingChoice,
  RoutingLogEntry,
} from "../types/workflow";
import type { JevTransport } from "../src/pr-review/types";
import { nodeById, nextNodes, mockNodeOutput } from "./workflowGraph";
import { evaluateWorkflowRules } from "./evaluateHardRules";
import { classifyWorkflowWithJev } from "./classifyWithJev";
const THRESHOLD = 0.85;
function append(
  state: RouterState,
  entry: Omit<RoutingLogEntry, "step">,
  status: RouterState["status"],
  pendingNode?: string,
): RouterState {
  return {
    ...state,
    currentNode: entry.finalNode,
    status,
    pendingNode,
    log: [...state.log, { ...entry, step: state.log.length + 1 }],
  };
}
export async function routeStep(
  state: RouterState,
  transport?: JevTransport,
  signal?: AbortSignal,
  source: "jev" | "mock" = "jev",
): Promise<RouterState> {
  if (!state.request.trim() || state.request.length > 6000)
    throw Error("Enter a request of 1–6,000 characters.");
  if (state.status !== "ready")
    throw Error(
      "Resolve the approval or start a new request before continuing.",
    );
  if (state.log.length >= 20)
    throw Error("Step limit reached. Start a new request.");
  const current = nodeById(state.currentNode);
  if (!current) throw Error("Unknown current node.");
  const policy = evaluateWorkflowRules(
    state.request,
    nextNodes(state.currentNode),
  );
  const base = {
    from: state.currentNode,
    confidence: null,
    probability: null,
    selected: null,
    source: "deterministic" as const,
    excluded: policy.excluded,
  };
  if (policy.blockedRequest || current.policy === "always_blocked")
    return append(
      state,
      {
        ...base,
        finalNode: "blocked",
        policyOverride: "always_blocked",
        explanation: policy.reason || "This node is always blocked.",
      },
      "blocked",
    );
  const candidates = [...policy.candidates, nodeById("needs_clarification")!];
  let choice: RoutingChoice;
  if (policy.candidates.length === 1 && policy.candidates[0].id === "end")
    choice = {
      nodeId: "end",
      confidence: null,
      probability: null,
      source: "deterministic",
    };
  else if (!policy.candidates.length)
    choice = {
      nodeId: "needs_clarification",
      confidence: null,
      probability: null,
      source: "deterministic",
    };
  else
    try {
      choice = await classifyWorkflowWithJev(
        state.request,
        current,
        candidates,
        transport,
        signal,
      );
      choice.source = source;
    } catch (e) {
      if (signal?.aborted) throw e;
      choice = {
        nodeId: "needs_clarification",
        confidence: null,
        probability: null,
        source: "unavailable",
        error: e instanceof Error ? e.message : "Classification unavailable.",
      };
    }
  if (signal?.aborted) throw signal.reason;
  const selected = nodeById(choice.nodeId);
  const low =
    choice.source !== "deterministic" &&
    (choice.confidence === null ||
      choice.probability === null ||
      Math.min(choice.confidence, choice.probability) < THRESHOLD);
  const entry = {
    ...base,
    selected: choice.nodeId,
    confidence: choice.confidence,
    probability: choice.probability,
    source: choice.source,
  };
  if (low || !selected || selected.id === "needs_clarification")
    return append(
      state,
      {
        ...entry,
        finalNode: "needs_clarification",
        policyOverride: low ? "confidence_gate" : null,
        explanation:
          choice.error ||
          (low
            ? "At least one score is missing or below 85%. Clarify the request before proceeding."
            : "The available choices do not support a confident route."),
      },
      "clarification",
    );
  // Recheck graph membership and policy after classification. No model choice can bypass them.
  if (
    selected.policy === "always_blocked" ||
    !policy.candidates.some((n) => n.id === selected.id)
  )
    return append(
      state,
      {
        ...entry,
        finalNode: "blocked",
        policyOverride: "always_blocked",
        explanation: "The selected node is not an allowed edge.",
      },
      "blocked",
    );
  if (selected.policy === "requires_approval")
    return append(
      state,
      {
        ...entry,
        finalNode: "approval",
        policyOverride: "requires_approval",
        explanation:
          "Configuration changes require explicit approval. No mock write has occurred.",
      },
      "approval",
      selected.id,
    );
  return append(
    state,
    {
      ...entry,
      finalNode: selected.id,
      policyOverride: null,
      explanation:
        selected.id === "end"
          ? "The only next edge is Complete; no Jev request is needed."
          : "The selected node passed the confidence gate and deterministic policy.",
      output: mockNodeOutput(selected.id),
    },
    selected.type === "end" ? "ended" : "ready",
  );
}
export function approveMockStep(
  state: RouterState,
  approved: boolean,
): RouterState {
  const target = nodeById(state.pendingNode || "");
  if (
    state.status !== "approval" ||
    state.currentNode !== "approval" ||
    target?.policy !== "requires_approval" ||
    state.log.at(-1)?.selected !== target.id
  )
    throw Error("No valid pending approval.");
  const blocked = evaluateWorkflowRules(state.request, [target]).blockedRequest;
  return append(
    state,
    {
      from: "approval",
      selected: target.id,
      finalNode: approved && !blocked ? target.id : "blocked",
      confidence: null,
      probability: null,
      source: "deterministic",
      policyOverride: blocked
        ? "always_blocked"
        : approved
          ? "approval_granted"
          : "approval_denied",
      explanation: blocked
        ? "The sensitive-data rule still applies."
        : approved
          ? "You approved this mock step. No real tool or configuration was accessed."
          : "Approval declined. The workflow stopped without executing the tool.",
      ...(approved && !blocked ? { output: mockNodeOutput(target.id) } : {}),
      excluded: [],
    },
    approved && !blocked ? "ready" : "blocked",
  );
}
