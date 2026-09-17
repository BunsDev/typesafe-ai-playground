"use client";
import { ResearchMetrics } from "./ResearchMetrics";
import type { ResearchMetrics as Metrics } from "../lib/researchMetrics";
import { useEffect, useRef, useState } from "react";
import type { Build, PartCandidate, PartVerification } from "../lib/neweggResearch";
import { errorMessage } from "../lib/client";
import { ErrorNote, Export, RunButton } from "./ui";
import { PC_BUILD_GOAL, resolveBrowserContext } from "../lib/browserTaskContext";
import { formatPcDebugReport } from "../lib/pcBuildDiagnostics";
import { CopyDebugReport } from "./CopyDebugReport";
type Result = { metrics?: Metrics; build: Build | null; candidates: PartCandidate[]; gaps: string[]; retrievedAt: string; error?: string; pricesVerified?: boolean; checks?: PartVerification[]; modelCalls?: number; contextCharacters?: number; elapsedMs: number };
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
export function PcBuildResearch({ goal = PC_BUILD_GOAL, onBusyChange }: { goal?: string; onBusyChange?: (busy: boolean) => void } = {}) {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [exchange, setExchange] = useState<{ response: unknown; httpStatus: number | null } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  async function run() {
    const context = resolveBrowserContext(goal);
    if (context.kind !== "newegg") { setError("Choose a supported Newegg PC goal before running."); return; }
    const c = new AbortController(); controller.current = c;
    setBusy(true); setError(""); setResult(null); setExchange(null);
    let httpStatus: number | null = null;
    try {
      const response = await fetch("/api/pc-build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal }), signal: c.signal });
      httpStatus = response.status;
      const data = await response.json();
      setExchange({ response: data, httpStatus });
      if (!response.ok) throw Error(data.error || "PC research failed.");
      setResult(data);
    } catch (e) { setExchange((previous) => previous ?? { response: null, httpStatus }); setError(c.signal.aborted ? "PC research stopped." : errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <div className="research-results">
    <p><strong>{goal}</strong></p>
    <p className="field-hint">US store · tower only · before tax and shipping. A focused AM5/DDR5 build search with Radeon RX 9070 XT and GeForce RTX 5070 Ti candidates. No cart or purchase actions.</p>
    <RunButton busy={busy} onClick={run} onCancel={() => controller.current?.abort()} usesJev={false}>Find PC parts</RunButton>
    <p role="status" className="field-hint">{busy ? "Reading listings in batches, selecting eight parts, and rechecking product pages…" : "Four concurrent reads · compact candidate table · one model selection call · budget checked in code."}</p>
    <ErrorNote message={error || result?.error || ""} />
    <CopyDebugReport disabled={busy || !exchange} version={exchange} createReport={() => formatPcDebugReport({ goal, response: exchange?.response ?? null, httpStatus: exchange?.httpStatus ?? null, error: error || result?.error || "", userAgent: navigator.userAgent })} />
    {result && <>
      <ResearchMetrics metrics={result.metrics} />
      <Export data={result} name="newegg-1440p-build.json" />
      <p className="field-hint">{result.candidates.length} candidates · {result.modelCalls ?? 0} model calls · {result.contextCharacters ?? 0} context characters · {(result.elapsedMs / 1000).toFixed(1)}s · retrieved {result.retrievedAt}</p>
      {!!result.gaps.length && <details open><summary>Search coverage gaps</summary><ul>{result.gaps.map((g) => <li key={g}>{g}</li>)}</ul></details>}
      {result.build && <>
        <h3>Proposed 1440p build · {money(result.build.totalCents)}</h3>
        <p>{result.build.summary}</p>
        <p>{money(result.build.remainingCents)} remaining before tax and shipping. {result.pricesVerified ? "Product prices and stock reconfirmed." : "Some prices or availability need review."}</p>
        <ul>{result.build.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        <ol className="research-answer">{result.build.parts.map((part) => <li key={part.id}>
          <h3>{part.category} · {money(part.priceCents)}</h3>
          <a href={part.url} target="_blank" rel="noreferrer">{part.title}</a>
          <p>{part.reason}</p>
          <details><summary>Observed specifications</summary><dl>{Object.entries(result.checks?.find((c) => c.id === part.id)?.specs || {}).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></details>
        </li>)}</ol>
      </>}
      <details><summary>Candidate parts and observed prices</summary><ul>{result.candidates.map((p) => <li key={p.id}>{p.category} · {money(p.priceCents)} · <a href={p.url} target="_blank" rel="noreferrer">{p.title}</a></li>)}</ul></details>
    </>}
  </div>;
}
