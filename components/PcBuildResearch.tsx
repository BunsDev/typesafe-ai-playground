"use client";
import { jevHeaders } from "../lib/api-key";
import { usageBlocked, recordUsage, usageContext } from "../lib/logUsageEntry";
import type { SelectionExchange } from "../lib/pcSelection";
import { ResearchMetrics } from "./ResearchMetrics";
import type { ResearchMetrics as Metrics } from "../lib/researchMetrics";
import { useEffect, useRef, useState } from "react";
import {
  Cpu,
  CircuitBoard,
  MemoryStick,
  HardDrive,
  Zap,
  Box,
  Wind,
  Monitor,
  ArrowUpRight,
  Globe2,
  Check,
} from "lucide-react";
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
      if (!c.signal.aborted) timer = setTimeout(poll, 1500);
    };
    void poll();
    return () => {
      c.abort();
      clearTimeout(timer);
    };
  }, [sessionId]);
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
          <div className="browser-start pc-welcome">
            <div className="pc-welcome-icon">
              <Globe2 size={24} />
              <span>NEWEGG / PC BUILDER</span>
            </div>
            <h2>
              {busy
                ? "Finding your next build."
                : "Your next build starts here."}
            </h2>
            <p>
              {busy
                ? "Opening Newegg in an isolated browser-use session…"
                : "Eight parts. One budget. Every source linked. Let your browser do the research for your next gaming PC."}
            </p>
            {!busy && (
              <div className="pc-brief">
                <span>
                  <strong>$2,500</strong> USD budget
                </span>
                <i />
                <span>
                  <strong>1440p</strong> gaming
                </span>
                <i />
                <span>
                  <strong>Tower</strong> only
                </span>
              </div>
            )}
            {!busy && (
              <div
                className="pc-component-strip"
                aria-label="Eight component categories"
              >
                {[
                  [Monitor, "GPU"],
                  [Cpu, "CPU"],
                  [CircuitBoard, "Board"],
                  [MemoryStick, "Memory"],
                  [HardDrive, "Storage"],
                  [Zap, "Power"],
                  [Box, "Case"],
                  [Wind, "Cooling"],
                ].map(([Icon, label]) => {
                  const Component = Icon as typeof Cpu;
                  return (
                    <div key={String(label)}>
                      <Component size={19} strokeWidth={1.5} />
                      <span>{String(label)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {!busy && (
              <ol
                className="browser-onboarding"
                aria-label="How this browser agent works"
              >
                <li>
                  <span>01</span>
                  <div>
                    <strong>Give it a goal</strong>
                    <p>Use the PC preset or edit the request below.</p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Watch it browse</strong>
                    <p>
                      The browser reads listings. Jev ranks parts. Code checks
                      the budget.
                    </p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>Review before buying</strong>
                    <p>
                      Inspect the parts, check the sources, and copy the full
                      debug report.
                    </p>
                  </div>
                </li>
              </ol>
            )}
            {!busy && (
              <p className="field-hint">
                If Jev is unavailable, a local price-only baseline keeps
                research moving. Nothing is added to your cart.
              </p>
            )}
          </div>
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
        className="browser-sidepanel research-results"
        hidden={!inspectorOpen}
      >
        <p>
          <strong>{goal}</strong>
        </p>
        <p className="field-hint">
          US store · tower only · before tax and shipping. A focused AM5/DDR5
          build search with Radeon RX 9070 XT and GeForce RTX 5070 Ti
          candidates. No cart or purchase actions.
        </p>
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
        <p role="status" className="field-hint">
          {busy
            ? "Browsing listings, selecting eight parts with Jev, and rechecking product pages…"
            : "Local browser-use · Jev closed choices · budget checked in code."}
        </p>
        <ErrorNote message={error || result?.error || ""} />
        <div hidden={!inspectorOpen}>
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
        {result && (
          <>
            <ResearchMetrics metrics={result.metrics} />
            <Export data={result} name="newegg-1440p-build.json" />
            <p className="field-hint">
              {result.candidates.length} candidates · {result.modelCalls ?? 0}{" "}
              model calls · {result.contextCharacters ?? 0} context characters ·{" "}
              {(result.elapsedMs / 1000).toFixed(1)}s · retrieved{" "}
              {result.retrievedAt}
            </p>
            {!!result.gaps.length && (
              <details open>
                <summary>Search coverage gaps</summary>
                <ul>
                  {result.gaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </details>
            )}
            {result.build && (
              <>
                <h3>
                  {result.build.selectionMethod === "local-budget-baseline"
                    ? "Local budget baseline"
                    : "Proposed 1440p build"}{" "}
                  · {money(result.build.totalCents)}
                </h3>
                <p>{result.build.summary}</p>
                <p>
                  {money(result.build.remainingCents)} remaining before tax and
                  shipping.{" "}
                  {result.pricesVerified
                    ? "Product prices and stock reconfirmed."
                    : "Some prices or availability need review."}
                </p>
                <ul>
                  {result.build.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <ol className="research-answer">
                  {result.build.parts.map((part) => (
                    <li key={part.id}>
                      <h3>
                        {part.category} · {money(part.priceCents)}
                      </h3>
                      <a href={part.url} target="_blank" rel="noreferrer">
                        {part.title}
                      </a>
                      <p>{part.reason}</p>
                      <details>
                        <summary>Observed specifications</summary>
                        <dl>
                          {Object.entries(
                            result.checks?.find((c) => c.id === part.id)
                              ?.specs || {},
                          ).map(([k, v]) => (
                            <div key={k}>
                              <dt>{k}</dt>
                              <dd>{v}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    </li>
                  ))}
                </ol>
              </>
            )}
            <details>
              <summary>Candidate parts and observed prices</summary>
              <ul>
                {result.candidates.map((p) => (
                  <li key={p.id}>
                    {p.category} · {money(p.priceCents)} ·{" "}
                    <a href={p.url} target="_blank" rel="noreferrer">
                      {p.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </aside>
    </div>
  );
}
