"use client";
export function QuestionInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled}>
      <label htmlFor="gate-question">Incoming question</label>
      <textarea
        id="gate-question"
        value={value}
        rows={3}
        maxLength={4000}
        placeholder="Paste the message that just landed in the channel."
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="field-hint">
        The question is gated on its own. It does not need to appear in the
        transcript below.
      </span>
    </fieldset>
  );
}
