"use client";
import { EyeOff } from "lucide-react";
import { percent } from "../lib/client";
import {
  actionLabels,
  simActions,
  stateFields,
  type Decision,
  type SimAction,
  type SimState,
} from "../types/microduck";
const show = (value: SimState[keyof SimState] | undefined) =>
  typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
export const sourceNote: Record<Decision["source"], string> = {
  choice: "Jev named the action",
  argmax: "Jev named nothing valid, so its highest-scoring action was used",
  fallback: "Nothing usable came back, so the duck held position",
  random: "Random baseline",
  manual: "You drove; Jev only advised",
};
function ActionBars({
  probabilities,
  taken,
}: {
  probabilities: Partial<Record<SimAction, number>>;
  taken: SimAction;
}) {
  const scored = simActions.filter(
    (action) => probabilities[action] !== undefined,
  );
  if (!scored.length)
    return <p className="muted">No probabilities came back for this tick.</p>;
  return (
    <ul className="action-bars">
      {scored
        .sort((a, b) => probabilities[b]! - probabilities[a]!)
        .map((action) => (
          <li key={action} className={action === taken ? "taken" : ""}>
            <span>{actionLabels[action]}</span>
            <span className="probability-track">
              <span
                style={{
                  width: `${Math.max(0, Math.min(1, probabilities[action]!)) * 100}%`,
                }}
              />
            </span>
            <span className="count">{percent(probabilities[action])}</span>
          </li>
        ))}
    </ul>
  );
}
export function DuckTelemetry({
  decision,
  name,
}: {
  decision: Decision;
  name: string;
}) {
  const { degraded } = decision;
  return (
    <div className="telemetry">
      <div className="decision-top">
        <strong>
          {name} · tick {decision.tick} · {actionLabels[decision.action]}
        </strong>
        <span className="count">{Math.round(decision.latencyMs)} ms</span>
      </div>
      <p className="muted">
        {sourceNote[decision.source]}
        {decision.event ? ` · ${decision.event}` : ""}
      </p>
      {decision.error && <p className="error-text">{decision.error}</p>}
      <h3>What the duck sent</h3>
      <table className="state-table">
        <tbody>
          {stateFields.map((field) => {
            const withheld = !(field in decision.sent);
            return (
              <tr key={field} className={withheld ? "withheld" : ""}>
                <th scope="row">{field}</th>
                <td>
                  {withheld ? (
                    <span className="gate-label">
                      <EyeOff size={13} /> withheld
                    </span>
                  ) : (
                    show(decision.sent[field])
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3>How it scored the seven actions</h3>
      <ActionBars
        probabilities={decision.probabilities}
        taken={decision.action}
      />
      {degraded && (
        <div
          className="degraded"
          data-changed={degraded.action !== decision.action}
        >
          <h3>
            Same tick, {degraded.hidden.length} field
            {degraded.hidden.length === 1 ? "" : "s"} withheld
          </h3>
          <p className="muted">{degraded.hidden.join(", ")}</p>
          {degraded.error ? (
            <p className="error-text">{degraded.error}</p>
          ) : (
            <>
              <p>
                {degraded.action === decision.action
                  ? `Still ${actionLabels[degraded.action].toLowerCase()}. The withheld fields did not change the decision.`
                  : `${actionLabels[degraded.action]} instead of ${actionLabels[decision.action].toLowerCase()}. The withheld fields changed the decision.`}
              </p>
              <ActionBars
                probabilities={degraded.probabilities}
                taken={degraded.action}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
