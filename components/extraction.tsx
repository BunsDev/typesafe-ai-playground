"use client";
import { useEffect, useRef, useState } from "react";
import { FileText, Check, Braces } from "lucide-react";
import {
  extractCandidates,
  FIELDS,
  runExtraction,
  type Field,
  type Result,
} from "../src/extraction/extraction";
import { percent, errorMessage } from "../lib/client";
import { Empty, ErrorNote, Export, Heading, RunButton } from "./ui";
const sample = `INVOICE #NS-2048\n\nVendor: Northstar Studio LLC\nBill to: Westbridge Design Co.\nInvoice date: September 1, 2026\nDue date: September 30, 2026\n\nDesign services          $1,000.00\nProduction support        $200.00\nSubtotal                $1,200.00\nTax                        $50.00\nTotal due               $1,250.00\n\nThank you for your business.`;
const labels: Record<Field, string> = {
  date: "Date",
  counterparty: "Counterparty",
  amount: "Amount",
  document_type: "Document type",
};
export function Extraction() {
  const [text, setText] = useState(sample);
  const [fields, setFields] = useState<Field[]>([...FIELDS]);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const stale = !!snapshot && snapshot !== JSON.stringify([text, fields]);
  async function run() {
    setError("");
    setBusy(true);
    setResults([]);
    setSnapshot(JSON.stringify([text, fields]));
    controller.current = new AbortController();
    try {
      setResults(
        await runExtraction(text, {
          fields,
          signal: controller.current.signal,
        }),
      );
    } catch (e) {
      setError(
        controller.current.signal.aborted
          ? "Extraction stopped. Run again to see results."
          : errorMessage(e),
      );
    } finally {
      setBusy(false);
    }
  }
  let count = 0;
  try {
    const candidates = extractCandidates(text);
    count = fields.reduce((n, f) => n + candidates[f].length, 0);
  } catch {}
  return (
    <div className="workspace">
      <Heading
        eyebrow="Document extraction"
        title="Every value, grounded."
        description="Find likely values. Let Jev choose. Trace each result back to the source."
      >
        <span className="pill">
          <Braces size={14} /> Closed-set extraction
        </span>
      </Heading>
      <div className="split extraction-layout">
        <section className="panel source-panel">
          <div className="panel-heading">
            <div>
              <FileText size={17} />
              <h2>Source document</h2>
            </div>
            <button
              className="button quiet"
              disabled={busy}
              onClick={() => setText(sample)}
            >
              Load invoice
            </button>
          </div>
          <div className="panel-content grow">
            <label htmlFor="document">Paste document text</label>
            <textarea
              id="document"
              className="document-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={40000}
              disabled={busy}
              spellCheck={false}
            />
            <div className="input-meta">
              <span>Plain text · up to 40,000 characters</span>
              <span>{text.length.toLocaleString()}</span>
            </div>
            <fieldset disabled={busy}>
              <legend>Fields to extract</legend>
              <div className="field-options">
                {FIELDS.map((field) => (
                  <label
                    key={field}
                    className={fields.includes(field) ? "selected" : ""}
                  >
                    <input
                      type="checkbox"
                      checked={fields.includes(field)}
                      onChange={(e) =>
                        setFields(
                          e.target.checked
                            ? [...fields, field]
                            : fields.filter((f) => f !== field),
                        )
                      }
                    />
                    <Check size={13} />
                    {labels[field]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="method-note">
              <span>
                01 <strong>Find candidates</strong>
              </span>
              <span>
                02 <strong>Rank with Jev</strong>
              </span>
              <p>
                Values come directly from your document. Every field includes a{" "}
                <code>null</code> option.
              </p>
            </div>
          </div>
          <div className="panel-bottom">
            <span className="muted">
              {count} candidates · {fields.length} fields
            </span>
            <RunButton
              busy={busy}
              disabled={!text.trim() || !fields.length}
              onClick={run}
              onCancel={() => controller.current?.abort()}
            >
              Run extraction
            </RunButton>
          </div>
        </section>
        <section className="panel results-panel">
          <div className="panel-heading">
            <div>
              <h2>Extracted fields</h2>
              <span className="count">
                {
                  results.filter(
                    (r) => r.status === "ranked" && r.value !== null,
                  ).length
                }
                /{fields.length}
              </span>
            </div>
            <Export
              data={
                results.length
                  ? { source: JSON.parse(snapshot)[0], results }
                  : null
              }
              name="extraction.json"
            />
          </div>
          <div
            className="panel-content results-scroll"
            aria-live="polite"
            aria-busy={busy}
          >
            <ErrorNote message={error} />
            {stale && (
              <p className="notice">
                Input changed. Run extraction again to update these results.
              </p>
            )}
            {!results.length ? (
              <Empty
                title={
                  busy
                    ? "Choosing from the candidates…"
                    : "The source has the answers."
                }
              >
                {busy
                  ? "Jev is evaluating the selected fields."
                  : "Run extraction to see selected values, probabilities, and source evidence."}
              </Empty>
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Selected value</th>
                        <th>Probability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => (
                        <tr key={r.field}>
                          <th>{labels[r.field]}</th>
                          <td>
                            {r.status === "error" ? (
                              <span className="error-text">Failed</span>
                            ) : r.value === null ? (
                              <code className="null-value">null</code>
                            ) : (
                              <strong>{r.value}</strong>
                            )}
                          </td>
                          <td>
                            <span className="probability">
                              {percent(r.probability)}
                            </span>
                            {r.confidence !== null && (
                              <small>Confidence {percent(r.confidence)}</small>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="evidence-list">
                  {results.map((r) => (
                    <article className="evidence-card" key={r.field}>
                      <div className="evidence-title">
                        <h3>{labels[r.field]}</h3>
                        <span>{r.candidates.length} candidates + null</span>
                      </div>
                      {r.error ? (
                        <ErrorNote message={r.error} />
                      ) : r.evidence ? (
                        <blockquote>{r.evidence}</blockquote>
                      ) : (
                        <p className="muted">
                          {r.status === "no_candidates"
                            ? "No candidates found locally. Jev was not called."
                            : "Jev chose null. No source value was selected."}
                        </p>
                      )}
                      <div className="candidate-list">
                        {r.candidates.map((c) => (
                          <span
                            key={c.id}
                            className={r.value === c.value ? "chosen" : ""}
                          >
                            {r.value === c.value && <Check size={12} />}{" "}
                            {c.value}
                          </span>
                        ))}
                        <span
                          className={
                            r.value === null && r.status !== "error"
                              ? "chosen"
                              : ""
                          }
                        >
                          null
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="panel-footnote">
            Probability is Jev’s score for its selected choice, not a guarantee
            of accuracy.
          </div>
        </section>
      </div>
    </div>
  );
}
