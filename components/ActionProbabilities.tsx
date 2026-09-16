import { DOOM_ACTIONS, type ActionDecision } from "../types/doom";
import { ACTION_LABELS } from "../lib/classifyActionWithJev";
export function ActionProbabilities({
  decision,
}: {
  decision: ActionDecision | null;
}) {
  return (
    <div className="doom-probabilities">
      <h3>All ten allowed actions</h3>
      {DOOM_ACTIONS.map((action) => {
        const p = decision?.probabilities[action];
        return (
          <div
            className={
              decision?.action === action && !decision.error ? "selected" : ""
            }
            key={action}
          >
            <span>{ACTION_LABELS[action]}</span>
            <div className="doom-probability-track">
              <span style={{ width: (p ?? 0) * 100 + "%" }} />
            </div>
            <strong>
              {p === undefined ? "—" : (p * 100).toFixed(1) + "%"}
            </strong>
          </div>
        );
      })}
    </div>
  );
}
