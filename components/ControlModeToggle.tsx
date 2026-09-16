import type { ControlMode } from "../types/doom";
export function ControlModeToggle({
  mode,
  onChange,
}: {
  mode: ControlMode;
  onChange: (mode: ControlMode) => void;
}) {
  return (
    <fieldset className="doom-mode">
      <legend>Who is in control?</legend>
      <div role="radiogroup" aria-label="Control mode">
        {(
          [
            ["human", "Human control"],
            ["jev", "Jev control"],
            ["random", "Random baseline"],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            role="radio"
            aria-checked={mode === id}
            className={mode === id ? "selected" : ""}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
