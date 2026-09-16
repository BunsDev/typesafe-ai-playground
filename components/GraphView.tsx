import type { RouterState } from "../types/workflow";
import { WORKFLOW_NODES, nextNodes, nodeById } from "../lib/workflowGraph";
import { evaluateWorkflowRules } from "../lib/evaluateHardRules";
export function GraphView({ state }: { state: RouterState }) {
  const policy = evaluateWorkflowRules(
    state.request,
    nextNodes(state.currentNode),
  );
  return (
    <section>
      <div className="router-section-title">
        <h3>
          {state.status === "ready"
            ? "Available next nodes"
            : "Current position"}
        </h3>
        <span className="tag">{nodeById(state.currentNode)?.label}</span>
      </div>
      <div className="router-candidates">
        {(state.status === "ready" && !policy.blockedRequest
          ? [...policy.candidates, nodeById("needs_clarification")!]
          : []
        ).map((n) => (
          <div className="compact-finding" key={n.id}>
            <strong>{n.label}</strong>
            <code>{n.id}</code>
            <p>{n.description}</p>
            {n.policy && <span className="tag">Approval required</span>}
          </div>
        ))}
      </div>
      {policy.blockedRequest && state.status === "ready" && (
        <p className="router-policy-note">
          {policy.reason} No candidate will be sent to Jev.
        </p>
      )}
      {state.status !== "ready" && (
        <p className="field-hint">
          {state.status === "approval"
            ? "Waiting for your mock approval."
            : "This path has stopped. Start a new request to route again."}
        </p>
      )}
      {policy.excluded.length > 0 && (
        <p className="router-policy-note">
          Excluded before Jev: {policy.excluded.join(", ")} · always blocked
        </p>
      )}
      <details>
        <summary>View the full workflow</summary>
        <div className="router-tree compact-router-tree">
          <div className="router-tree-root">Start → choose a specialist</div>
          {WORKFLOW_NODES.filter((n) =>
            ["research_agent", "support_agent", "ops_agent"].includes(n.id),
          ).map((n) => (
            <div
              className={`router-branch ${state.currentNode === n.id ? "is-current" : ""}`}
              key={n.id}
            >
              <strong>{n.label}</strong>
              <span className="tag">{n.type}</span>
              <ul>
                {nextNodes(n.id).map((t) => (
                  <li key={t.id}>
                    <span>{t.label}</span>
                    <small>
                      {t.policy === "always_blocked"
                        ? "Always blocked"
                        : t.policy === "requires_approval"
                          ? "Pause for approval"
                          : "Allowed"}
                    </small>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="field-hint">
            Permitted tools lead to Complete. Needs clarification is always
            available. Policy may stop a request before any graph step.
          </p>
        </div>
      </details>
    </section>
  );
}
