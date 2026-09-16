import type { GameFeatures, GameFrame } from "../types/doom";
export function StateInspector({
  current,
  seen,
  currentTick,
}: {
  current: GameFeatures;
  seen: GameFrame | null;
  currentTick: number;
}) {
  return (
    <details className="doom-state">
      <summary>
        Inspect exactly what Jev sees{" "}
        <span>{seen ? "tick " + seen.tick : "No request yet"}</span>
      </summary>
      <p className="muted">
        Deterministic geometry supplies these features. Jev receives no pixels,
        source code, or hidden map. Visible targets must be within eight tiles,
        a 90° horizontal field of view, and an unobstructed line of sight.
      </p>
      {seen && (
        <p className="muted">
          Last submitted frame: {seen.tick}. Current frame: {currentTick}. The
          world may have moved since the request.
        </p>
      )}
      <div className="doom-feature-grid">
        {Object.entries(seen?.features ?? current).map(([key, value]) => (
          <div key={key}>
            <code>{key}</code>
            <strong>{String(value)}</strong>
          </div>
        ))}
      </div>
      <details>
        <summary>Current live features</summary>
        <pre>{JSON.stringify(current, null, 2)}</pre>
      </details>
    </details>
  );
}
