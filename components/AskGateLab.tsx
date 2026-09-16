"use client";
import { useEffect, useRef, useState } from "react";
import { Inbox, ShieldAlert } from "lucide-react";
import { errorMessage, runJev } from "../lib/client";
import {
  buildTriageRequest,
  defaultThreshold,
  resolveTriage,
  sampleContext,
  sampleDocs,
  sampleQuestion,
  sampleTranscript,
} from "../lib/classifyQuestionWithJev";
import { buildBatch, runBatches } from "../lib/batchTriage";
import { splitDocs, toHistory } from "../lib/matchEvidence";
import { parseTranscript } from "../web/conversation";
import type {
  BatchRow,
  ChatMessage,
  DocSnippet,
  EvidenceCandidate,
  JevResponse,
} from "../types/triage";
import { BatchTriageTable } from "./BatchTriageTable";
import { ContextInput } from "./ContextInput";
import { QuestionInput } from "./QuestionInput";
import { TriageResult } from "./TriageResult";
import { Empty, ErrorNote, Export, Heading, RunButton } from "./ui";
const historyLimit = 20;
interface Single {
  candidates: EvidenceCandidate[];
  response: JevResponse;
}
export function AskGateLab() {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [question, setQuestion] = useState(sampleQuestion);
  const [transcript, setTranscript] = useState(sampleContext);
  const [docs, setDocs] = useState(sampleDocs);
  const [format, setFormat] = useState("auto");
  const [model, setModel] = useState("jev-latest");
  const [threshold, setThreshold] = useState(
    Math.round(defaultThreshold * 100),
  );
  const [single, setSingle] = useState<Single | null>(null);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  let history: ChatMessage[] = [];
  let parseError = "";
  try {
    if (transcript.trim())
      history = toHistory(
        parseTranscript(transcript, format).messages,
        mode === "batch" ? 200 : historyLimit,
      );
  } catch (e) {
    parseError = errorMessage(e);
  }
  const snippets = docs.trim() ? splitDocs(docs) : [];
  const signature = JSON.stringify([
    mode,
    question,
    transcript,
    docs,
    format,
    model,
  ]);
  const stale = !!snapshot && snapshot !== signature;
  const input = { question, transcript, docs, format, model, historyLimit };
  function loadExample() {
    setQuestion(sampleQuestion);
    setTranscript(mode === "batch" ? sampleTranscript : sampleContext);
    setDocs(sampleDocs);
    setFormat("auto");
    setSingle(null);
    setRows([]);
  }
  function switchMode(next: "single" | "batch") {
    setMode(next);
    setSingle(null);
    setRows([]);
    setError("");
    setSnapshot("");
    if (transcript === sampleContext && next === "batch")
      setTranscript(sampleTranscript);
    if (transcript === sampleTranscript && next === "single")
      setTranscript(sampleContext);
  }
  async function run() {
    setError("");
    setProgress("");
    setBusy(true);
    setSingle(null);
    setRows([]);
    setSnapshot(signature);
    controller.current = new AbortController();
    const signal = controller.current.signal;
    try {
      if (mode === "single") {
        const request = buildTriageRequest(input);
        setSingle({
          candidates: request.candidates,
          response: (await runJev(request.payload, signal)) as JevResponse,
        });
      } else {
        const items = buildBatch({
          transcript,
          docs,
          format,
          model,
          historyLimit,
        });
        const settled = await runBatches(
          items,
          async (item) => ({
            item,
            response: (await runJev(
              item.request.payload,
              signal,
            )) as JevResponse,
          }),
          {
            signal,
            onProgress: (p) => setProgress(`${p.completed} / ${p.total} gated`),
          },
        );
        setRows(
          settled.map((result, index): BatchRow =>
            result.status === "fulfilled"
              ? {
                  index: result.value.item.index,
                  message: result.value.item.message,
                  candidates: result.value.item.request.candidates,
                  response: result.value.response,
                }
              : {
                  index: items[index].index,
                  message: items[index].message,
                  candidates: items[index].request.candidates,
                  error: errorMessage(result.reason),
                },
          ),
        );
      }
    } catch (e) {
      setError(signal.aborted ? "Triage stopped." : errorMessage(e));
      setSnapshot("");
    } finally {
      setBusy(false);
    }
  }
  const decision = single
    ? resolveTriage(single.response, single.candidates, threshold / 100)
    : null;
  const ready =
    (mode === "batch" || !!question.trim()) &&
    (!!history.length || !!snippets.length) &&
    !parseError;
  return (
    <div className="workspace">
      <Heading
        eyebrow="Ask gate"
        title="Ask Jev, or ask a human?"
        description="Gate incoming questions against what the channel already answered and what the docs already say."
      >
        <span className="pill">
          <ShieldAlert size={15} />
          Classification only · no answers written
        </span>
      </Heading>
      <div className="split">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <Inbox size={18} />
              <h2>What came in</h2>
            </div>
            <button
              className="button quiet"
              disabled={busy}
              onClick={loadExample}
            >
              Load example
            </button>
          </div>
          <div className="panel-content scroll">
            <fieldset disabled={busy}>
              <label htmlFor="gate-mode">Mode</label>
              <select
                id="gate-mode"
                value={mode}
                onChange={(event) =>
                  switchMode(event.target.value as "single" | "batch")
                }
              >
                <option value="single">One question</option>
                <option value="batch">Batch: gate a whole dump</option>
              </select>
            </fieldset>
            {mode === "single" && (
              <QuestionInput
                value={question}
                onChange={setQuestion}
                disabled={busy}
              />
            )}
            <ContextInput
              transcript={transcript}
              onTranscript={setTranscript}
              format={format}
              onFormat={setFormat}
              docs={docs}
              onDocs={setDocs}
              history={history}
              snippets={snippets}
              parseError={parseError}
              disabled={busy}
              transcriptLabel={
                mode === "single" ? "Recent conversation" : "Chat dump"
              }
              transcriptHint={
                mode === "single"
                  ? `Only the last ${historyLimit} messages are sent as context.`
                  : "Every question in here is gated against the messages above it."
              }
            />
            <fieldset disabled={busy}>
              <details className="disclosure">
                <summary>Model</summary>
                <label>
                  Model
                  <input
                    value={model}
                    maxLength={100}
                    onChange={(event) => setModel(event.target.value)}
                  />
                </label>
              </details>
            </fieldset>
          </div>
          <div className="panel-bottom">
            <span className="muted">
              {mode === "single"
                ? "2 closed-set questions · 1 request"
                : "Up to 3 requests in parallel"}
            </span>
            <RunButton
              busy={busy}
              disabled={!ready}
              onClick={run}
              onCancel={() => controller.current?.abort()}
            >
              Run triage
            </RunButton>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>The gate</h2>
            <Export
              data={
                decision || rows.length
                  ? {
                      run: JSON.parse(snapshot || signature),
                      threshold: threshold / 100,
                      ...(decision
                        ? { decision, response: single?.response }
                        : { rows }),
                    }
                  : null
              }
              name="ask-gate.json"
            />
          </div>
          <div className="panel-content scroll" aria-live="polite">
            <ErrorNote message={error} />
            {stale && (
              <p className="notice">
                Input changed. Run triage again for an up-to-date decision.
              </p>
            )}
            {busy && (
              <p role="status" className="muted">
                {progress || "Gating…"}
              </p>
            )}
            {decision ? (
              <TriageResult
                decision={decision}
                candidates={single!.candidates}
                response={single!.response}
              />
            ) : rows.length ? (
              <BatchTriageTable rows={rows} threshold={threshold / 100} />
            ) : (
              <Empty title="Does this really need a person?">
                Run triage to see whether the channel or the docs already
                answered it, with the exact line that proves it.
              </Empty>
            )}
            <div className="threshold">
              <label htmlFor="gate-threshold">
                Confidence needed to keep it from a human{" "}
                <strong>{threshold}%</strong>
              </label>
              <input
                id="gate-threshold"
                type="range"
                min={0}
                max={100}
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
              />
              <div className="input-meta">
                <span>Gate more questions</span>
                <span>Trust a person</span>
              </div>
            </div>
          </div>
          <p className="panel-footnote">
            Jev only picks one of four outcomes and one piece of evidence. Any
            weak or unsupported match falls back to a human.
          </p>
        </section>
      </div>
    </div>
  );
}
