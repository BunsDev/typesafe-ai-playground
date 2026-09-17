"use client";
import type { AgentState } from "../types/browserAgent";
import {
  analyzeRun,
  formatDebugReport,
  type DebugContext,
} from "../lib/browserAgentDiagnostics";
import { CopyDebugReport } from "./CopyDebugReport";

export function BrowserAgentDiagnostics({
  state,
  busy,
  context,
}: {
  state: AgentState;
  busy: boolean;
  context: DebugContext;
}) {
  const analytics = analyzeRun(state);
  const ms = (value: number | null) =>
    value === null ? "Not measured" : `${value.toFixed(1)} ms`;
  return (
    <section aria-label="Run diagnostics">
      <details className="inspector-section">
        <summary>Run diagnostics</summary>
        <dl className="agent-status">
          <div>
            <dt>Decision samples</dt>
            <dd>{analytics.decisionLatencyMs.n}</dd>
          </div>
          <div>
            <dt>Median / p95</dt>
            <dd>
              {ms(analytics.decisionLatencyMs.median)} /{" "}
              {ms(analytics.decisionLatencyMs.p95)}
            </dd>
          </div>
          <div>
            <dt>Known input / output tokens</dt>
            <dd>
              {analytics.tokens.input.knownTotal} /{" "}
              {analytics.tokens.output.knownTotal}
            </dd>
          </div>
        </dl>
        <p className="field-hint">
          Single-run measurements. Token coverage:{" "}
          {analytics.tokens.input.reportedCycles}/{state.decisions} input,{" "}
          {analytics.tokens.output.reportedCycles}/{state.decisions} output
          decision calls. Missing usage is unknown. The report includes prompts,
          page text, model answers, and verification evidence.
        </p>
      </details>
      <CopyDebugReport
        disabled={busy || !state.log.length}
        version={state.log}
        createReport={() =>
          formatDebugReport(state, {
            ...context,
            environment: {
              userAgent: navigator.userAgent,
              pathname: location.pathname,
              viewport: { width: innerWidth, height: innerHeight },
              language: navigator.language,
            },
          })
        }
      />
    </section>
  );
}
