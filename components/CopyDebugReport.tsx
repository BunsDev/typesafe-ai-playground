"use client";
import { useEffect, useRef, useState } from "react";

export function CopyDebugReport({ createReport, disabled, version }: { createReport: () => string; disabled?: boolean; version: unknown }) {
  const [report, setReport] = useState("");
  const [message, setMessage] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setReport(""); setMessage(""); }, [version]);
  async function copy() {
    const text = createReport();
    setReport(text);
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Debug report copied. Paste it into your debugging agent.");
    } catch {
      setMessage("Clipboard unavailable. Select and copy the report below.");
      requestAnimationFrame(() => { field.current?.focus(); field.current?.select(); });
    }
  }
  return <section aria-label="Debug report">
    <button type="button" className="button" disabled={disabled} onClick={copy}>Copy debug report</button>
    {message && <p role="status" className="field-hint">{message}</p>}
    {report && <label>Debug report text<textarea ref={field} aria-label="Debug report text" readOnly rows={10} value={report} onFocus={(event) => event.currentTarget.select()} /></label>}
  </section>;
}
