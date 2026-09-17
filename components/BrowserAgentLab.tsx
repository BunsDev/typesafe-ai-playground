"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppWindow,
  Bot,
  Eye,
  Play,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Square,
} from "lucide-react";
import { useUsage, usageBlocked } from "../lib/logUsageEntry";
import { errorMessage, percent } from "../lib/client";
import {
  agentCycle,
  createAgentState,
  observe,
  runAgent,
  type LoopState,
} from "../lib/agentLoop";
import {
  FLIGHT_GOAL,
  defaultSandbox,
  flightSandboxHtml,
  verifyFlightSearch,
  type SandboxOptions,
} from "../lib/flightSandbox";
import { formatElementTable } from "../lib/getElementTable";
import {
  describeCycle,
  exportRun,
  isEscalation,
  outcomeLabels,
} from "../lib/logStep";
import { textHelperStatus, type TextHelperStatus } from "../lib/textHelper";
import type {
  AgentStatus,
  CycleLog,
  TextHelperMode,
  VerificationReport,
} from "../types/browserAgent";
import { Empty, ErrorNote, Export, Heading } from "./ui";
const statusLabels: Record<AgentStatus, string> = {
  ready: "Ready",
  running: "Running",
  done: "Done · verified",
  blocked: "Blocked",
  failed: "Failed",
  stopped: "Stopped",
};
function Bars({
  probabilities,
  chosen,
  limit = 6,
}: {
  probabilities: Record<string, number>;
  chosen: string | null;
  limit?: number;
}) {
  const rows = Object.entries(probabilities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  if (!rows.length)
    return <p className="field-hint">No probabilities reported.</p>;
  return (
    <ul className="agent-bars">
      {rows.map(([key, value]) => (
        <li key={key} aria-current={key === chosen ? "true" : undefined}>
          <span>{key}</span>
          <i style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }} />
          <b>{percent(value)}</b>
        </li>
      ))}
    </ul>
  );
}
function Checks({ report }: { report: VerificationReport }) {
  return (
    <ul className="agent-checks">
      {Object.entries(report.checks).map(([name, ok]) => (
        <li key={name} data-ok={ok ? "true" : "false"}>
          <span aria-hidden="true">{ok ? "✓" : "✗"}</span>
          {name.replaceAll("_", " ")}
        </li>
      ))}
    </ul>
  );
}
export function BrowserAgentLab() {
  useUsage();
  const quotaBlocked = usageBlocked();
  const [goal, setGoal] = useState(FLIGHT_GOAL);
  const [model, setModel] = useState("jev-latest");
  const [textMode, setTextMode] = useState<TextHelperMode>("auto");
  const [helper, setHelper] = useState<TextHelperStatus | null>(null);
  const [sandbox, setSandbox] = useState<SandboxOptions>(defaultSandbox);
  const [sandboxKey, setSandboxKey] = useState(0);
  const [state, setState] = useState<LoopState>(() =>
    createAgentState(FLIGHT_GOAL),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const controller = useRef<AbortController | null>(null);
  const html = useMemo(() => flightSandboxHtml(sandbox), [sandbox]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const c = new AbortController();
    textHelperStatus(c.signal).then(setHelper);
    return () => c.abort();
  }, []);
  function frameContext() {
    const doc = frame.current?.contentDocument;
    const win = frame.current?.contentWindow;
    if (!doc?.body || !win) throw Error("The sandbox site has not loaded yet.");
    return { doc, win };
  }
  function reset(options = sandbox) {
    controller.current?.abort();
    setSandbox(options);
    setSandboxKey((k) => k + 1);
    setState(createAgentState(goal));
    setSelected(null);
    setError("");
  }
  const finished = !["ready", "running"].includes(state.status);
  async function run(steps: number) {
    setError("");
    setBusy(true);
    const c = new AbortController();
    controller.current = c;
    try {
      const { doc, win } = frameContext();
      const final = await runAgent(
        {
          doc,
          win,
          goal,
          model,
          textMode,
          verify: (d) => verifyFlightSearch(d),
          signal: c.signal,
          onUpdate: setState,
        },
        { ...state, goal },
        steps,
      );
      setState(final);
      setSelected(null);
    } catch (e) {
      setError(c.signal.aborted ? "Run stopped." : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function look() {
    try {
      const { doc, win } = frameContext();
      setState((s) =>
        observe(
          {
            doc,
            win,
            goal,
            model,
            textMode,
            verify: (d) => verifyFlightSearch(d),
            signal: new AbortController().signal,
          },
          s,
        ),
      );
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function verifyNow() {
    try {
      const { doc } = frameContext();
      setState((s) => ({ ...s, verification: verifyFlightSearch(doc) }));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const last = state.log.at(-1) ?? null;
  const shown: CycleLog | null =
    selected === null
      ? last
      : (state.log.find((e) => e.step === selected) ?? last);
  const table = state.page ? formatElementTable(state.page.elements) : [];
  const escalations = state.log.filter((e) => isEscalation(e.outcome)).length;
  const helperLabel =
    textMode === "jev-span"
      ? "Jev picks a span of the goal"
      : helper?.configured
        ? `Server LLM · ${helper.model}`
        : textMode === "llm"
          ? "Server LLM · not configured"
          : "Jev picks a span of the goal (no TEXT_MODEL_API_KEY on the server)";
  return (
    <div
      className="workspace compact-lab agent-workspace"
      data-status={state.status}
    >
      <Heading
        eyebrow="AGENTS · DYNAMIC INDEXED ACTION SPACE"
        title="Jev-powered browser agent"
        description="One goal in. Each cycle Jev reads an indexed element table and picks an operation plus a target in one round trip. A small LLM writes text only for TYPE_TEXT, and DONE is checked independently."
      >
        <div className="agent-tags" aria-label="Tags">
          <span className="pill">
            <Bot size={14} /> Agents
          </span>
          <span className="pill">Speculative fan-out</span>
          <span className="pill">No screenshots</span>
        </div>
      </Heading>
      <div className="lab-columns agent-columns">
        <section className="panel lab-panel">
          <div className="panel-heading">
            <h2>Goal and run</h2>
            <button
              className="button quiet"
              disabled={busy}
              onClick={() => reset()}
            >
              <RotateCcw size={14} /> Reset sandbox
            </button>
          </div>
          <fieldset className="lab-fields" disabled={busy}>
            <label>
              Goal
              <textarea
                aria-label="Goal"
                rows={4}
                maxLength={2000}
                value={goal}
                onChange={(e) => {
                  setGoal(e.target.value);
                  setState((s) => ({ ...s, goal: e.target.value }));
                }}
              />
            </label>
            <p className="field-hint">
              The verifier checks a one-way Zurich → London search on 2026-09-20
              for one adult in economy, with results visible and nothing
              selected. Change the goal and the verifier will still check that
              task.
            </p>
            <div className="row-fields">
              <label>
                Model
                <input
                  aria-label="Model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </label>
              <label>
                Text helper
                <select
                  aria-label="Text helper"
                  value={textMode}
                  onChange={(e) =>
                    setTextMode(e.target.value as TextHelperMode)
                  }
                >
                  <option value="auto">Auto</option>
                  <option value="llm">Server LLM only</option>
                  <option value="jev-span">Jev goal spans only</option>
                </select>
              </label>
            </div>
            <p className="field-hint">Text for TYPE_TEXT: {helperLabel}.</p>
            <label className="lab-checkbox">
              <input
                type="checkbox"
                checked={sandbox.overlay}
                onChange={(e) =>
                  reset({ ...sandbox, overlay: e.target.checked })
                }
              />
              A popover covers the Search button until dismissed (covered-target
              path)
            </label>
            <label className="lab-checkbox">
              <input
                type="checkbox"
                checked={sandbox.slowResults}
                onChange={(e) =>
                  reset({ ...sandbox, slowResults: e.target.checked })
                }
              />
              Results load slowly (WAIT path)
            </label>
          </fieldset>
          <ErrorNote message={error} />
          <div className="lab-actions">
            <button
              className="button primary"
              disabled={busy || finished || quotaBlocked}
              onClick={() => run(Infinity)}
            >
              <Play size={14} /> Run agent
            </button>
            <button
              className="button"
              disabled={busy || finished || quotaBlocked}
              onClick={() => run(1)}
            >
              <SkipForward size={14} /> One cycle
            </button>
            {busy && (
              <button
                className="button"
                onClick={() => controller.current?.abort()}
              >
                <Square size={13} /> Stop
              </button>
            )}
            <button className="button" disabled={busy} onClick={look}>
              <Eye size={14} /> Observe only
            </button>
            <button className="button" disabled={busy} onClick={verifyNow}>
              <ShieldCheck size={14} /> Verify now
            </button>
          </div>
          <dl className="agent-status">
            <div>
              <dt>Status</dt>
              <dd>
                <span className="tag" data-status={state.status}>
                  {statusLabels[state.status]}
                </span>
              </dd>
            </div>
            <div>
              <dt>Elapsed</dt>
              <dd>{(state.elapsedMs / 1000).toFixed(2)} s</dd>
            </div>
            <div>
              <dt>Decisions</dt>
              <dd>{state.decisions}</dd>
            </div>
            <div>
              <dt>Actions</dt>
              <dd>{state.actions}</dd>
            </div>
            <div>
              <dt>Escalations</dt>
              <dd>{escalations}</dd>
            </div>
            <div>
              <dt>Text calls</dt>
              <dd>{state.textCalls}</dd>
            </div>
          </dl>
          {state.reason && <p className="agent-reason">{state.reason}</p>}
          <div className="agent-verification" id="agent-verification">
            <div className="router-section-title">
              <h3>Independent verification</h3>
              <span className="tag">
                {state.verification
                  ? state.verification.passed
                    ? "passed"
                    : "not passed"
                  : "not run"}
              </span>
            </div>
            {state.verification ? (
              <>
                <p className="field-hint">{state.verification.summary}</p>
                <Checks report={state.verification} />
              </>
            ) : (
              <p className="field-hint">
                Runs when Jev chooses DONE, or on demand. It reads the sandbox
                DOM, never the model.
              </p>
            )}
          </div>
        </section>
        <section className="panel lab-panel agent-sandbox-panel">
          <div className="panel-heading">
            <div>
              <h2>
                <AppWindow size={16} /> Sandbox site
              </h2>
            </div>
            <span className="tag">synthetic · Jev never sees these pixels</span>
          </div>
          <iframe
            key={sandboxKey}
            ref={frame}
            className="agent-sandbox"
            title="Skyline, a synthetic flight search site"
            srcDoc={html}
          />
        </section>
      </div>
      <div
        className="lab-columns agent-columns agent-inspector"
        id="agent-inspector"
      >
        <section className="panel lab-panel">
          <div className="panel-heading">
            <h2>What Jev sees</h2>
            <span className="tag">
              {table.length} {table.length === 1 ? "element" : "elements"}
            </span>
          </div>
          {table.length ? (
            <pre className="agent-table" aria-label="Indexed element table">
              {table.join("\n")}
            </pre>
          ) : (
            <Empty title="No observation yet">
              Run a cycle or choose Observe only to read the current element
              table.
            </Empty>
          )}
          {state.page && (
            <details>
              <summary>Visible page text sent with the table</summary>
              <pre className="agent-table">{state.page.text || "(none)"}</pre>
            </details>
          )}
        </section>
        <section className="panel lab-panel">
          <div className="panel-heading">
            <h2>
              {shown && shown !== last
                ? `Cycle ${shown.step}`
                : "Latest decision"}
            </h2>
            <Export
              data={
                state.log.length ? exportRun(state, state.verification) : null
              }
              name="jev-browser-agent-run.json"
            />
          </div>
          {shown ? (
            <div className="agent-decision">
              <p>
                <strong>{describeCycle(shown)}</strong>
              </p>
              <div className="step-badges">
                <span className="tag">{outcomeLabels[shown.outcome]}</span>
                {shown.confidence !== null && (
                  <span className="tag">
                    operation confidence {percent(shown.confidence)}
                  </span>
                )}
                {shown.targetConfidence !== null && (
                  <span className="tag">
                    target confidence {percent(shown.targetConfidence)}
                  </span>
                )}
                <span className="tag">Jev {shown.jevLatencyMs} ms</span>
                {shown.textHelper && (
                  <span className="tag">
                    text · {shown.textHelper} · {shown.textLatencyMs} ms
                  </span>
                )}
                {shown.speculativeHeads.length > 0 && (
                  <span className="tag">
                    discarded heads: {shown.speculativeHeads.join(", ")}
                  </span>
                )}
              </div>
              <h3>Operation</h3>
              <Bars
                probabilities={shown.operationProbabilities}
                chosen={shown.operation}
              />
              {Object.keys(shown.targetProbabilities).length > 0 && (
                <>
                  <h3>Target for {shown.operation}</h3>
                  <Bars
                    probabilities={shown.targetProbabilities}
                    chosen={shown.target}
                  />
                </>
              )}
              {shown.verification && <Checks report={shown.verification} />}
            </div>
          ) : (
            <Empty title="No decision yet">
              Each cycle sends the operation question and every compatible
              target head in one request.
            </Empty>
          )}
          <section className="router-step-log">
            <div className="router-section-title">
              <h3>Cycle log</h3>
              <span className="tag">
                {state.log.length} {state.log.length === 1 ? "cycle" : "cycles"}
              </span>
            </div>
            <ol>
              {state.log.map((e) => (
                <li key={e.step} data-outcome={e.outcome}>
                  <div className="step-number">{e.step}</div>
                  <div>
                    <button
                      className="link-button"
                      type="button"
                      onClick={() => setSelected(e.step)}
                      aria-pressed={shown?.step === e.step}
                    >
                      {describeCycle(e)}
                    </button>
                    <div className="step-badges">
                      <span className="tag">{e.elapsedMs} ms</span>
                      {e.confidence !== null && (
                        <span className="tag">{percent(e.confidence)}</span>
                      )}
                      {e.pageChanged !== null && (
                        <span className="tag">
                          {e.pageChanged ? "page changed" : "no change"}
                        </span>
                      )}
                    </div>
                    <details>
                      <summary>Element table at this cycle</summary>
                      <pre className="agent-table">
                        {e.elementTable.join("\n")}
                      </pre>
                    </details>
                  </div>
                </li>
              ))}
            </ol>
            {!state.log.length && (
              <p className="field-hint">Your first cycle will appear here.</p>
            )}
          </section>
        </section>
      </div>
    </div>
  );
}
