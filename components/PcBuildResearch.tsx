"use client";
import { jevHeaders } from "../lib/api-key";
import { usageBlocked, recordUsage, usageContext } from "../lib/logUsageEntry";
import type { SelectionExchange } from "../lib/pcSelection";
import { ResearchMetrics } from "./ResearchMetrics";
import type { ResearchMetrics as Metrics } from "../lib/researchMetrics";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { PcBuildWelcome } from "./PcBuildWelcome";
import { createPortal } from "react-dom";
import type {
  Build,
  PartCandidate,
  PartVerification,
} from "../lib/neweggResearch";
import { errorMessage } from "../lib/client";
import { ErrorNote, Export, RunButton } from "./ui";
import {
  PC_BUILD_GOAL,
  resolveBrowserContext,
} from "../lib/browserTaskContext";
import { formatPcDebugReport } from "../lib/pcBuildDiagnostics";
import { CopyDebugReport } from "./CopyDebugReport";
type Result = {
  metrics?: Metrics;
  build: Build | null;
  candidates: PartCandidate[];
  gaps: string[];
  retrievedAt: string;
  error?: string;
  pricesVerified?: boolean;
  checks?: PartVerification[];
  modelCalls?: number;
  contextCharacters?: number;
  elapsedMs: number;
};
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export function PcBuildResearch({
  goal = PC_BUILD_GOAL,
  onBusyChange,
  controlsHost,
  inspectorOpen = true,
  onOpenInspector,
}: {
  goal?: string;
  onBusyChange?: (busy: boolean) => void;
  controlsHost?: HTMLDivElement | null;
  inspectorOpen?: boolean;
  onOpenInspector?: () => void;
} = {}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [browser, setBrowser] = useState<{
    screenshot?: string | null;
    url?: string;
    error?: string | null;
    phase?: string;
    completedReads?: number;
  }>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [exchange, setExchange] = useState<{
    response: unknown;
    httpStatus: number | null;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      if (sessionRef.current)
        void fetch(`/api/local-browser?id=${sessionRef.current}`, {
          method: "DELETE",
          keepalive: true,
        });
    },
    [],
  );
  useEffect(() => {
    if (!sessionId) return;
    const c = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/local-browser?id=${sessionId}`, {
          signal: c.signal,
        });
        if (response.ok) setBrowser(await response.json());
      } catch {
        /* Next poll retries transient display failures. */
      }
      if (!c.signal.aborted && busy) timer = setTimeout(poll, 1500);
    };
    void poll();
    return () => {
      c.abort();
      clearTimeout(timer);
    };
  }, [sessionId, busy]);
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  async function run() {
    const context = resolveBrowserContext(goal);
    if (context.kind !== "newegg") {
      setError("Choose a supported Newegg PC goal before running.");
      return;
    }
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError("");
    setResult(null);
    setExchange(null);
    let httpStatus: number | null = null;
    const usage = usageContext();
    try {
      if (sessionRef.current)
        await fetch(`/api/local-browser?id=${sessionRef.current}`, {
          method: "DELETE",
          signal: c.signal,
        });
      const opened = await fetch("/api/local-browser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          width: Math.round(viewport.current?.clientWidth || 1440),
          height: Math.round(viewport.current?.clientHeight || 900),
        }),
        signal: c.signal,
      });
      const session = await opened.json();
      if (!opened.ok)
        throw Error(session.error || "Local browser could not start.");
      sessionRef.current = session.sessionId;
      setSessionId(session.sessionId);
      setBrowser({});
      const response = await fetch("/api/pc-build", {
        method: "POST",
        headers: jevHeaders(),
        body: JSON.stringify({
          goal,
          sessionId: session.sessionId,
          selectionMode: usageBlocked() ? "local" : "jev",
        }),
        signal: c.signal,
      });
      httpStatus = response.status;
      const data = await response.json();
      setExchange({ response: data, httpStatus });
      for (const exchange of (data.selectionExchanges ??
        []) as SelectionExchange[])
        recordUsage(
          exchange.request,
          exchange.providerUsage ?? null,
          exchange.error ? "failed" : "success",
          "/api/pc-build",
          usage,
          "jev-browser-agent",
        );
      if (!response.ok) throw Error(data.error || "PC research failed.");
      setResult(data);
    } catch (e) {
      setExchange((previous) => previous ?? { response: null, httpStatus });
      setError(c.signal.aborted ? "PC research stopped." : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function stop() {
    controller.current?.abort();
    if (sessionRef.current)
      void fetch(`/api/local-browser?id=${sessionRef.current}`, {
        method: "DELETE",
      });
  }
  return (
    <div className="local-browser-workspace">
      <div
        className="local-browser-view"
        aria-label="Local browser viewport"
        ref={viewport}
      >
        {browser.screenshot ? (
          <img
            src={`data:image/jpeg;base64,${browser.screenshot}`}
            alt="Current page in the local browser-use session"
          />
        ) : (
          <PcBuildWelcome busy={busy} />
        )}
      </div>
      {busy && (
        <div className="browser-progress" role="status">
          <span className="browser-progress-pulse" />
          <strong>{browser.phase || "Opening local browser"}</strong>
          <span>{browser.completedReads ?? 0} / 17 page reads</span>
          <progress
            aria-label="Research page reads"
            max={17}
            value={browser.completedReads ?? 0}
          />
        </div>
      )}
      <div className="browser-page-caption">
        <span>{browser.url || "Local browser-use · isolated session"}</span>
        <span role="status">
          {busy
            ? "Researching…"
            : result?.build
              ? `${money(result.build.totalCents)} · 8 parts · open Inspector`
              : "Ready"}
        </span>
      </div>
      <div className="local-browser-error">
        <ErrorNote message={error || result?.error || browser.error || ""} />
      </div>
      {result?.build && !inspectorOpen && (
        <div className="local-browser-result">
          <div>
            <span className="build-ready-icon">
              <Check size={18} />
            </span>
            <div>
              <strong>
                {result.build.selectionMethod === "local-budget-baseline"
                  ? "Local baseline ready for review"
                  : "Your parts list is ready"}
              </strong>
              <p>
                {money(result.build.totalCents)} ·{" "}
                {money(result.build.remainingCents)} left ·{" "}
                {result.pricesVerified
                  ? "Price and stock checks passed"
                  : "Verification gaps to review"}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="button primary"
            onClick={onOpenInspector}
          >
            Review build <ArrowUpRight size={16} />
          </button>
        </div>
      )}
      <aside
        id="browser-inspector"
        className="browser-sidepanel pc-inspector"
        hidden={!inspectorOpen}
        aria-label="Browser inspector"
      >
        <header className="inspector-heading">
          <h2>Inspector</h2>
          <span>{busy ? "Working" : result ? "Run complete" : "Ready"}</span>
        </header>
        {controlsHost ? (
          createPortal(
            <RunButton
              busy={busy}
              onClick={run}
              onCancel={stop}
              usesJev={false}
            >
              Find PC parts
            </RunButton>,
            controlsHost,
          )
        ) : (
          <RunButton busy={busy} onClick={run} onCancel={stop} usesJev={false}>
            Find PC parts
          </RunButton>
        )}
        <ErrorNote message={error || result?.error || ""} />
        {!result && (
          <p className="inspector-empty">
            {busy
              ? `${browser.phase || "Opening local browser"}…`
              : "Your parts and verification details will appear here."}
          </p>
        )}
        {result?.build && (
          <>
            <section className="inspector-build-summary">
              <h3>
                {result.build.selectionMethod === "local-budget-baseline"
                  ? "Local budget baseline"
                  : "Proposed 1440p build"}
              </h3>
              <div className="inspector-total">
                {money(result.build.totalCents)}
                <span>/ $2,500</span>
              </div>
              <progress
                aria-label="Build budget"
                value={result.build.totalCents}
                max={250000}
              />
              <p>
                {money(result.build.remainingCents)} left · before tax &
                shipping
              </p>
              <span
                className="inspector-check-status"
                data-verified={result.pricesVerified ? "true" : "false"}
              >
                {result.pricesVerified
                  ? "Prices & stock checked"
                  : "Verification gaps to review"}
              </span>
            </section>
            <ol className="inspector-parts">
              {result.build.parts.map((part) => (
                <li key={part.id}>
                  <div>
                    <span>
                      {part.category}
                      <small>{part.id}</small>
                    </span>
                    <strong>{money(part.priceCents)}</strong>
                  </div>
                  <a
                    href={part.url}
                    target="_blank"
                    rel="noreferrer"
                    title={part.title}
                  >
                    {part.title}
                  </a>
                </li>
              ))}
            </ol>
            <details className="inspector-section">
              <summary>
                Verification & notes<span>{result.build.warnings.length}</span>
              </summary>
              <p>{result.build.summary}</p>
              <ul>
                {result.build.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
              {result.build.parts.map((part) => (
                <details key={part.id}>
                  <summary>
                    {part.category} · {part.id}
                  </summary>
                  <p>{part.reason}</p>
                  <dl>
                    {Object.entries(
                      result.checks?.find((check) => check.id === part.id)
                        ?.specs || {},
                    ).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ))}
            </details>
          </>
        )}
        {result && (
          <>
            {!!result.gaps.length && (
              <details className="inspector-section">
                <summary>
                  Coverage gaps<span>{result.gaps.length}</span>
                </summary>
                <ul>
                  {result.gaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              </details>
            )}
            <details className="inspector-section">
              <summary>
                Candidates<span>{result.candidates.length}</span>
              </summary>
              <ul>
                {result.candidates.map((part) => (
                  <li key={part.id}>
                    {part.id} · {part.category} · {money(part.priceCents)}
                    <br />
                    <a href={part.url} target="_blank" rel="noreferrer">
                      {part.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
            <details className="inspector-section">
              <summary>
                Run data<span>{(result.elapsedMs / 1000).toFixed(1)}s</span>
              </summary>
              <ResearchMetrics metrics={result.metrics} />
              <p className="field-hint">
                {result.candidates.length} candidates · {result.modelCalls ?? 0}{" "}
                model calls · retrieved {result.retrievedAt}
              </p>
              <Export data={result} name="newegg-1440p-build.json" />
            </details>
          </>
        )}
        <div className="inspector-report">
          <CopyDebugReport
            disabled={busy || !exchange}
            version={exchange}
            createReport={() =>
              formatPcDebugReport({
                goal,
                response: exchange?.response ?? null,
                httpStatus: exchange?.httpStatus ?? null,
                error: error || result?.error || "",
                userAgent: navigator.userAgent,
              })
            }
          />
        </div>
      </aside>
    </div>
  );
}
