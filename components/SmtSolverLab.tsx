"use client";
import { revealResults } from "../lib/scroll";
import { useEffect, useRef, useState } from "react";
import { Heading, RunButton, ErrorNote, Export } from "./ui";
import { SOLVER_EXAMPLES } from "../lib/smt/examples";
import { CONSTRAINT_TYPES, type ConstraintType } from "../lib/smt/parser";
import { runSolverCheck, type SolverRun } from "../lib/smt/runner";
import { errorMessage, percent } from "../lib/client";
const typeNames = {
  boolean: "Boolean logic",
  integer: "Integer arithmetic",
  equality: "Equality checks",
  ordering: "Ordering constraints",
  scheduling: "Simple scheduling conflicts",
};
const ms = (n: number) => `${Math.round(n)} ms`;
export function SmtSolverLab() {
  const [text, setText] = useState(SOLVER_EXAMPLES[0].text),
    [type, setType] = useState<ConstraintType>("integer"),
    [decompose, setDecompose] = useState(true),
    [proof, setProof] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [result, setResult] = useState<SolverRun | null>(null),
    [bench, setBench] = useState<{ name: string; run: SolverRun }[]>([]);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  function invalidate() {
    setResult(null);
    setError("");
    setProgress("");
  }
  async function run(benchmark = false) {
    setBusy(true);
    setError("");
    setProgress("Classifying constraints…");
    if (benchmark) setBench([]);
    else setResult(null);
    const controller = new AbortController();
    abort.current = controller;
    try {
      if (benchmark) {
        for (const example of SOLVER_EXAMPLES) {
          setProgress(`Benchmark: ${example.name}`);
          const r = await runSolverCheck(
            example.text,
            example.type,
            decompose,
            proof,
            controller.signal,
            (s) => setProgress(`${example.name} · ${s}`),
          );
          setBench((old) => [...old, { name: example.name, run: r }]);
        }
      } else
        setResult(
          await runSolverCheck(
            text,
            type,
            decompose,
            proof,
            controller.signal,
            setProgress,
          ),
        );
      setProgress("Complete");
      revealResults(benchmark ? "solver-benchmark" : "solver-results");
    } catch (e) {
      setError(
        controller.signal.aborted
          ? "Stopped. Incomplete checks are not results."
          : errorMessage(e),
      );
      setProgress("");
    } finally {
      setBusy(false);
    }
  }
  const eligible = bench.filter((b) => b.run.routing.agreement !== null),
    agreements = eligible.filter((b) => b.run.routing.agreement).length;
  return (
    <div className="workspace compact-lab smt-workspace">
      <Heading
        eyebrow="EXACT VERIFICATION + PROBABILISTIC TRIAGE"
        title="SMT solver lab"
        description="Can every constraint be true at once? Compare Jev’s prediction with Z3’s exact check."
      />
      <div className="lab-columns">
        <section className="panel lab-panel">
          <div className="panel-heading">
            <h2>Constraint problem</h2>
            <span className="tag">Z3 + Jev</span>
          </div>
          <fieldset className="lab-fields" disabled={busy}>
            <label>
              Seeded example
              <select
                aria-label="Seeded example"
                defaultValue="0"
                onChange={(e) => {
                  const ex = SOLVER_EXAMPLES[Number(e.target.value)];
                  setText(ex.text);
                  setType(ex.type);
                  invalidate();
                }}
              >
                {SOLVER_EXAMPLES.map((ex, i) => (
                  <option key={ex.name} value={i}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Constraint type
              <select
                aria-label="Constraint type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value as ConstraintType);
                  invalidate();
                }}
              >
                {CONSTRAINT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {typeNames[t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Constraints
              <textarea
                aria-label="Constraints"
                rows={12}
                className="code-input"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  invalidate();
                }}
              />
            </label>
            <p className="field-hint">
              One constraint per line. Boolean values and integers only; up to
              60 constraints and 40 variables.
            </p>
            <label className="lab-checkbox">
              <input
                type="checkbox"
                checked={decompose}
                onChange={(e) => {
                  setDecompose(e.target.checked);
                  invalidate();
                }}
              />{" "}
              Classify independent groups in parallel
            </label>
            <label className="lab-checkbox">
              <input
                type="checkbox"
                checked={proof}
                onChange={(e) => {
                  setProof(e.target.checked);
                  invalidate();
                }}
              />{" "}
              Full exact check required
            </label>
            <details>
              <summary>Syntax & scheduling examples</summary>
              <p>
                Use =, ==, !=, &lt;, &lt;=, &gt;, &gt;=, +, -, multiplication by
                an integer, parentheses, !, &amp;&amp;, || and =&gt;.
              </p>
              <code>(a_end &lt;= b_start) || (b_end &lt;= a_start)</code>
              <p>
                This explicitly requires two meetings not to overlap.
                Availability flags alone do not create scheduling rules.
                Unsupported syntax is rejected; constraints are never executed
                as code.
              </p>
            </details>
          </fieldset>
          <ErrorNote message={error} />
          <div className="lab-actions">
            <RunButton
              busy={busy}
              onClick={() => run()}
              onCancel={() => abort.current?.abort()}
              disabled={!text.trim()}
            >
              Run Check
            </RunButton>
          </div>
          <p role="status" className="field-hint">
            {progress}
          </p>
          <p className="field-hint">
            Jev has four fixed choices. Confidence below 85% requires
            decomposition. Every run is verified against the full set by Z3.
          </p>
        </section>
        <section
          id="solver-results"
          className="panel lab-panel lab-result-target"
        >
          <div className="panel-heading">
            <h2>Comparison</h2>
            <Export data={result} name="solver-comparison.json" />
          </div>
          {result ? (
            <div className="lab-result-stack">
              <div className="compact-verdict">
                <span className="eyebrow">EXACT SOLVER RESULT</span>
                <h2>{result.exact.result}</h2>
                <strong>{result.routing.route}</strong>
                <p>{result.routing.detail}</p>
                {result.exact.reason && <p>{result.exact.reason}</p>}
                {result.routing.proofNote && <p>{result.routing.proofNote}</p>}
              </div>
              <div className="solver-metrics">
                <article className="compact-finding">
                  <span>Z3 · source of truth</span>
                  <h3>{result.exact.result}</h3>
                  <p>
                    {ms(result.exact.latencyMs)} server ·{" "}
                    {ms(result.exactRoundTripMs)} round trip
                  </p>
                </article>
                <article className="compact-finding">
                  <span>Jev · prediction</span>
                  <h3>{result.jev.prediction}</h3>
                  <p>
                    {percent(result.jev.confidence)} conservative score ·{" "}
                    {ms(result.jev.latencyMs)} round trip
                  </p>
                  {result.jev.rawPrediction &&
                    result.jev.rawPrediction !== result.jev.prediction && (
                      <p>
                        Raw choice: {result.jev.rawPrediction} → below
                        confidence gate
                      </p>
                    )}
                </article>
              </div>
              <div className="compact-finding">
                <strong>
                  Agreement:{" "}
                  {result.routing.agreement === null
                    ? "Not comparable"
                    : result.routing.agreement
                      ? "Yes"
                      : "No"}
                </strong>
                <p>{result.routing.priority}</p>
              </div>
              <section>
                <h3>Independent groups · {result.groups.length}</h3>
                <p className="field-hint">
                  Only variable-disjoint groups are separated. The combined
                  score is a minimum score, not a calibrated joint probability.
                </p>
                {result.groups.map((g, i) => (
                  <details key={i} className="compact-finding">
                    <summary>
                      Group {i + 1} · {g.problem.constraints.length} constraints
                      · {g.prediction.prediction} ·{" "}
                      {percent(g.prediction.confidence)}
                    </summary>
                    <pre>{g.problem.constraints.join("\n")}</pre>
                    {g.prediction.error && <p>{g.prediction.error}</p>}
                  </details>
                ))}
              </section>
            </div>
          ) : (
            <div className="empty">
              <h3>Prediction meets verification</h3>
              <p>
                Run a seeded example or paste a small logic problem. Z3 remains
                authoritative when the methods disagree.
              </p>
            </div>
          )}
        </section>
      </div>
      <section
        id="solver-benchmark"
        className="panel lab-panel benchmark-panel lab-result-target"
      >
        <div className="panel-heading">
          <div>
            <h2>Seeded benchmark</h2>
            <p className="field-hint">
              Five measured cases · API calls use your configured key
            </p>
          </div>
          <button className="button" disabled={busy} onClick={() => run(true)}>
            Run benchmark
          </button>
        </div>
        <p className="field-hint">
          {bench.length
            ? `${agreements}/${eligible.length} comparable cases agree (${eligible.length ? Math.round((agreements / eligible.length) * 100) + "%" : "—"}); ${bench.length - eligible.length} abstentions or unknowns. ${bench.length}/5 cases completed.`
            : "No benchmark measurements yet."}{" "}
          Latency includes network and initialization; these examples are not a
          general accuracy claim.
        </p>
        <div className="table-scroll">
          <table className="solver-table">
            <thead>
              <tr>
                <th>Example</th>
                <th>Z3</th>
                <th>Jev</th>
                <th>Confidence</th>
                <th>Z3 server</th>
                <th>Jev round trip</th>
                <th>Agree</th>
              </tr>
            </thead>
            <tbody>
              {SOLVER_EXAMPLES.map((ex) => {
                const row = bench.find((b) => b.name === ex.name)?.run;
                return (
                  <tr key={ex.name}>
                    <td>{ex.name}</td>
                    <td>{row?.exact.result || "—"}</td>
                    <td>{row?.jev.prediction || "—"}</td>
                    <td>{percent(row?.jev.confidence)}</td>
                    <td>{row ? ms(row.exact.latencyMs) : "—"}</td>
                    <td>{row ? ms(row.jev.latencyMs) : "—"}</td>
                    <td>
                      {row?.routing.agreement == null
                        ? "—"
                        : row.routing.agreement
                          ? "Yes"
                          : "No"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
