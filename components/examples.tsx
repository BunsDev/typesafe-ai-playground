"use client";
import { useEffect, useRef, useState } from "react";
import { Search, Upload, Plus, FlaskConical } from "lucide-react";
import catalog from "../web/catalog.json";
import * as library from "../web/library";
import { runJev, errorMessage, percent, download } from "../lib/client";
import { Empty, ErrorNote, Export, Heading, RunButton } from "./ui";
type ResponseData = {
  answers?: Record<
    string,
    {
      type: string;
      choice?: string;
      noul?: number;
      score?: number;
      confidence?: number;
      probabilities?: Record<string, number>;
    }
  >;
};
const initial = library.catalogExamples(catalog);
export function Examples() {
  const [resultsOpen, setResultsOpen] = useState(false);
  const [examples, setExamples] = useState(initial);
  const [selected, setSelected] = useState(initial[0].id);
  const [drafts, setDrafts] = useState<Record<string, library.Draft>>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<
    { label: string; data?: ResponseData; error?: string }[]
  >([]);
  const [model, setModel] = useState("jev-latest");
  const [runSignature, setRunSignature] = useState("");
  const controller = useRef<AbortController | null>(null);
  const [restored, setRestored] = useState(false);
  const storageWritable = useRef(true);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("typesafe-playground-workspace-v2");
      if (raw) {
        const saved = JSON.parse(raw);
        if (
          saved.schemaVersion !== 1 ||
          !Array.isArray(saved.custom) ||
          !saved.drafts ||
          typeof saved.drafts !== "object"
        )
          throw Error(
            "Saved workspace could not be restored. Export or recover your existing browser data before replacing it.",
          );
        const custom = saved.custom.map((item: unknown) => ({
          ...library.normalizeExample(item),
          custom: true,
        }));
        const all = [...initial, ...custom];
        if (new Set(all.map((e) => e.id)).size !== all.length)
          throw Error(
            "Saved workspace contains duplicate IDs. Original browser data has been preserved.",
          );
        const clean: Record<string, library.Draft> = {};
        for (const [id, value] of Object.entries(saved.drafts)) {
          const draft = value as library.Draft;
          if (
            all.some((e) => e.id === id) &&
            typeof draft.stateText === "string"
          )
            clean[id] = {
              stateText: draft.stateText,
              stateMode: ["auto", "text", "json"].includes(draft.stateMode)
                ? draft.stateMode
                : "auto",
              questions: library.normalizeQuestions(draft.questions),
            };
        }
        setExamples(all);
        setDrafts(clean);
        if (all.some((e) => e.id === saved.activeId))
          setSelected(saved.activeId);
        if (typeof saved.model === "string") setModel(saved.model);
      }
    } catch (e) {
      storageWritable.current = false;
      setError(errorMessage(e));
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored || !storageWritable.current) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          "typesafe-playground-workspace-v2",
          JSON.stringify({
            schemaVersion: 1,
            activeId: selected,
            model,
            custom: examples.filter((e) => e.custom),
            drafts,
          }),
        );
      } catch {
        storageWritable.current = false;
        setError(
          "Browser storage is unavailable. Export the library to keep your edits.",
        );
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [restored, selected, model, examples, drafts]);
  useEffect(() => () => controller.current?.abort(), []);
  const example = examples.find((e) => e.id === selected) || examples[0];
  const draft = drafts[example.id] || library.draftFor(example);
  const signature = JSON.stringify([selected, draft, model]);
  function update(patch: Partial<library.Draft>) {
    setDrafts((d) => ({ ...d, [example.id]: { ...draft, ...patch } }));
  }
  const filtered = examples.filter(
    (e) =>
      (category === "All categories" || category === e.category) &&
      `${e.title} ${e.description} ${e.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function run(compare = false) {
    setResultsOpen(true);
    setError("");
    setResults([]);
    setBusy(true);
    setRunSignature(signature);
    controller.current = new AbortController();
    try {
      const payload = library.buildPayload(
        draft.stateText,
        draft.questions,
        model,
        draft.stateMode,
      );
      const requests = [
        {
          label: compare ? example.comparison!.labelA : example.title,
          payload,
        },
        ...(compare
          ? [
              {
                label: example.comparison!.labelB,
                payload: {
                  ...payload,
                  state: library.comparisonState(
                    payload.state,
                    example.comparison,
                  ),
                },
              },
            ]
          : []),
      ];
      setResults(
        await Promise.all(
          requests.map(async (r) => {
            try {
              return {
                label: r.label,
                data: await runJev(r.payload, controller.current!.signal),
              };
            } catch (e) {
              return {
                label: r.label,
                error: controller.current!.signal.aborted
                  ? "Run stopped."
                  : errorMessage(e),
              };
            }
          }),
        ),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024)
        throw Error("Import a JSON file smaller than 2 MB.");
      const imported = library.importExamples(
        await file.text(),
        examples.map((e) => e.id),
      );
      setExamples([...examples, ...imported]);
      setSelected(imported[0].id);
      setCategory("All categories");
      setSearch("");
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function exportLibrary() {
    try {
      download(
        "typesafe-examples.json",
        library.exportExamples(examples, drafts),
      );
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <div className="workspace">
      <ErrorNote message={error} />
      <div
        className={`examples-layout ${resultsOpen ? "results-open" : "results-collapsed"}`}
      >
        <aside className="panel library-panel">
          <div className="panel-heading">
            <h2>Examples</h2>
            <button
              className="button quiet"
              disabled={busy}
              aria-label="Create example"
              onClick={() => {
                const custom: library.Example = {
                  id: `custom-${Date.now()}`,
                  title: "Untitled experiment",
                  category: "Custom",
                  collection: "Use cases",
                  description: "Your own classification experiment.",
                  state: "Paste the text to evaluate.",
                  questions: [
                    {
                      id: "relevant",
                      label: "Relevant",
                      type: "noul",
                      instructions:
                        "Is the text relevant to the intended topic?",
                      selected: true,
                      enabled: true,
                    },
                  ],
                  tryThis: "",
                  custom: true,
                };
                setExamples([...examples, custom]);
                setSelected(custom.id);
                setCategory("All categories");
                setSearch("");
              }}
            >
              <Plus size={17} />
            </button>
          </div>
          <div className="library-filters">
            <div className="search-input">
              <Search size={15} />
              <input
                aria-label="Search examples"
                placeholder="Search examples…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {[
                "All categories",
                ...new Set(examples.map((e) => e.category)),
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="example-list">
            {filtered.map((e) => (
              <button
                disabled={busy}
                className={
                  e.id === selected ? "example-item selected" : "example-item"
                }
                key={e.id}
                onClick={() => {
                  setSelected(e.id);
                  setResults([]);
                  setError("");
                }}
              >
                <span>{e.category}</span>
                <strong>{e.title}</strong>
                <p>{e.description}</p>
                {e.comparison && <small>A/B comparison</small>}
              </button>
            ))}
            {!filtered.length && <p className="muted">No matching examples.</p>}
          </div>
          <div className="library-actions">
            <label className="button quiet">
              <Upload size={13} />
              Import
              <input
                type="file"
                accept="application/json,.json"
                disabled={busy}
                onChange={(e) => {
                  void importFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
                className="file-input"
              />
            </label>
            <button className="button quiet" onClick={exportLibrary}>
              Export library
            </button>
          </div>
        </aside>
        <section className="panel experiment-panel">
          <div className="panel-heading">
            <h2>Test setup</h2>
            <span className="count">
              {draft.questions.filter((q) => q.selected && q.enabled).length}{" "}
              questions
            </span>
          </div>
          <div className="panel-content scroll">
            <h1>{example.title}</h1>
            <p className="muted">{example.description}</p>
            <fieldset disabled={busy}>
              <label htmlFor="example-state">Input state</label>
              <textarea
                id="example-state"
                className="code-input"
                rows={10}
                value={draft.stateText}
                onChange={(e) => update({ stateText: e.target.value })}
              />
              <div className="form-row">
                <label>
                  Input format
                  <select
                    value={draft.stateMode}
                    onChange={(e) => update({ stateMode: e.target.value })}
                  >
                    <option value="auto">Auto</option>
                    <option value="text">Text</option>
                    <option value="json">JSON</option>
                  </select>
                </label>
                <label>
                  Model
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </label>
              </div>
              <label>Questions</label>
              {draft.questions.map((q, i) => (
                <details className="question-edit" key={q.id}>
                  <summary>
                    <span>{q.label}</span>
                    <span className="type-badge">{q.type}</span>
                  </summary>
                  <div className="rule-edit">
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={q.selected}
                        onChange={(e) =>
                          update({
                            questions: draft.questions.map((v, j) =>
                              j === i
                                ? { ...v, selected: e.target.checked }
                                : v,
                            ),
                          })
                        }
                      />
                      Include this question
                    </label>
                    <label>
                      Instructions
                      <textarea
                        value={q.instructions}
                        rows={3}
                        onChange={(e) =>
                          update({
                            questions: draft.questions.map((v, j) =>
                              j === i
                                ? { ...v, instructions: e.target.value }
                                : v,
                            ),
                          })
                        }
                      />
                    </label>
                    {q.criteria && (
                      <pre className="criteria-preview">
                        {JSON.stringify(q.criteria, null, 2)}
                      </pre>
                    )}
                  </div>
                </details>
              ))}
              <details className="disclosure">
                <summary>Edit all questions as JSON</summary>
                <p className="muted">
                  Edit types, candidate definitions, or add questions. Apply
                  before running.
                </p>
                <QuestionEditor
                  key={example.id}
                  questions={draft.questions}
                  onApply={(questions) => update({ questions })}
                />
              </details>
            </fieldset>
            {example.tryThis && (
              <div className="tip">
                <strong>Try this</strong>
                <p>{example.tryThis}</p>
              </div>
            )}
            {example.test && (
              <details className="disclosure">
                <summary>Reference notes</summary>
                <p>{example.test.note}</p>
                <pre className="criteria-preview">
                  {JSON.stringify(
                    { A: example.test.expectedA, B: example.test.expectedB },
                    null,
                    2,
                  )}
                </pre>
              </details>
            )}
          </div>
          <div className="panel-bottom">
            <RunButton
              busy={busy}
              onClick={() => run()}
              onCancel={() => controller.current?.abort()}
            >
              Run example
            </RunButton>
            {example.comparison && (
              <button
                className="button"
                disabled={busy}
                onClick={() => run(true)}
              >
                Compare A/B
              </button>
            )}
          </div>
        </section>
        <section className="panel example-results">
          <button
            className="results-toggle"
            type="button"
            aria-label={resultsOpen ? "Collapse results" : "Expand results"}
            aria-expanded={resultsOpen}
            onClick={() => setResultsOpen(!resultsOpen)}
          >
            <span aria-hidden="true">{resultsOpen ? "›" : "‹"}</span>
            <span>Results</span>
            <span className="count">
              {busy ? "RUNNING" : results.length ? "DONE" : "READY"}
            </span>
          </button>
          <div className="panel-heading">
            <h2>Results</h2>
            <Export data={results.length ? results : null} />
          </div>
          <div className="panel-content scroll" aria-live="polite">
            {runSignature &&
              runSignature !== signature &&
              results.length > 0 && (
                <p className="notice">
                  Setup changed. Run again to refresh results.
                </p>
              )}
            {!results.length ? (
              <Empty
                title={busy ? "Jev is evaluating…" : "Ready to experiment."}
              >
                Choose an example, inspect the input, and run it to see typed
                results here.
              </Empty>
            ) : (
              results.map((r, i) => (
                <article className="example-result" key={i}>
                  <span className="eyebrow">
                    {results.length > 1
                      ? `Variant ${i ? "B" : "A"}`
                      : "Completed"}
                  </span>
                  <h3>{r.label}</h3>
                  {r.error ? (
                    <ErrorNote message={r.error} />
                  ) : (
                    Object.entries(r.data?.answers || {}).map(
                      ([name, answer]) => (
                        <div className="answer-card" key={name}>
                          <div className="input-meta">
                            <strong>{name.replaceAll("_", " ")}</strong>
                            <span>{answer.type}</span>
                          </div>
                          <div className="answer-value">
                            {answer.type === "choice"
                              ? answer.choice
                              : answer.type === "noul"
                                ? percent(answer.noul)
                                : String(answer.score ?? "—")}
                          </div>
                          {answer.confidence !== undefined && (
                            <span className="muted">
                              Confidence {percent(answer.confidence)}
                            </span>
                          )}
                          {answer.probabilities &&
                            Object.entries(answer.probabilities)
                              .sort((a, b) => b[1] - a[1])
                              .map(([choice, p]) => (
                                <div className="distribution" key={choice}>
                                  <div className="input-meta">
                                    <span>{choice}</span>
                                    <span>{percent(p)}</span>
                                  </div>
                                  <div className="probability-track">
                                    <span style={{ width: percent(p) }} />
                                  </div>
                                </div>
                              ))}
                        </div>
                      ),
                    )
                  )}
                  <details className="disclosure">
                    <summary>Raw response</summary>
                    <pre className="criteria-preview">
                      {JSON.stringify(r.data, null, 2)}
                    </pre>
                  </details>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
function QuestionEditor({
  questions,
  onApply,
}: {
  questions: library.Question[];
  onApply: (q: library.Question[]) => void;
}) {
  const serialized = JSON.stringify(questions, null, 2);
  const [edit, setEdit] = useState<{ base: string; raw: string } | null>(null);
  const [error, setError] = useState("");
  const conflict = !!edit && edit.base !== serialized;
  const raw = edit?.raw ?? serialized;
  return (
    <>
      <textarea
        aria-label="Questions JSON"
        className="code-input"
        rows={8}
        value={raw}
        onChange={(e) =>
          setEdit({ base: edit?.base ?? serialized, raw: e.target.value })
        }
      />
      {conflict && (
        <p className="notice">
          Questions changed above while you were editing JSON. Reload the
          current questions before applying.
        </p>
      )}
      <ErrorNote message={error} />
      <div className="inline-actions">
        <button
          className="button"
          disabled={conflict}
          onClick={() => {
            try {
              const questions = library.normalizeQuestions(JSON.parse(raw));
              onApply(questions);
              setEdit(null);
              setError("");
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          Apply questions
        </button>
        {edit && (
          <button
            className="button quiet"
            onClick={() => {
              setEdit(null);
              setError("");
            }}
          >
            Reload current questions
          </button>
        )}
      </div>
    </>
  );
}
