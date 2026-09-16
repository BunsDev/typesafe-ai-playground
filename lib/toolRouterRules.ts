import type { WorkflowNode } from "../types/workflow";
/** Deliberately conservative demo rule; no model interpretation can override it. */
export function evaluateWorkflowRules(
  request: string,
  candidates: WorkflowNode[],
) {
  const blockedRequest =
    /\b(?:passwords?|secrets?|credentials?|private\s+keys?|api\s+keys?)\b/i.test(
      request,
    );
  const excluded = candidates
    .filter((n) => n.policy === "always_blocked")
    .map((n) => n.id);
  return {
    blockedRequest,
    excluded,
    candidates: candidates.filter((n) => n.policy !== "always_blocked"),
    reason: blockedRequest
      ? "Sensitive-data rule: requests mentioning passwords, secrets, credentials or private/API keys are blocked before Jev."
      : null,
  };
}
