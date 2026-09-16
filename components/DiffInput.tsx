import type { GovernanceInput } from "../types/governance";
export function DiffInput({
  value,
  onChange,
  disabled,
}: {
  value: GovernanceInput;
  onChange: (v: GovernanceInput) => void;
  disabled: boolean;
}) {
  const field =
    (key: keyof GovernanceInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...value, [key]: e.target.value });
  return (
    <fieldset disabled={disabled} className="lab-fields">
      <label>
        PR title
        <input value={value.title} onChange={field("title")} maxLength={500} />
      </label>
      <label>
        Unified diff
        <textarea
          className="code-input"
          rows={12}
          aria-label="Unified diff"
          value={value.diff}
          onChange={field("diff")}
          placeholder="Paste a unified diff…"
        />
      </label>
      <details>
        <summary>Description & repo policy</summary>
        <label>
          PR description
          <textarea
            rows={3}
            aria-label="PR description"
            value={value.description}
            onChange={field("description")}
          />
        </label>
        <label>
          Repo policy JSON
          <textarea
            className="code-input"
            rows={5}
            aria-label="Repo policy JSON"
            value={value.policy}
            onChange={field("policy")}
          />
        </label>
        <p className="field-hint">
          Optional array of rules with id, kind, paths, description. Built-in
          safety rules always apply.
        </p>
      </details>
      <details>
        <summary>Codebase manifest / symbol index</summary>
        <label>
          Manifest JSON
          <textarea
            className="code-input"
            rows={10}
            aria-label="Manifest JSON"
            value={value.manifest}
            onChange={field("manifest")}
          />
        </label>
        <p className="field-hint">
          Optional symbols, calls, hashes and test mappings. Missing context
          requires review.
        </p>
      </details>
    </fieldset>
  );
}
