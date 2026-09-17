import type { ResearchMetrics as Metrics } from "../lib/researchMetrics";
const count = (value: number | null) => value === null ? "Not reported" : value.toLocaleString();
const usd = (value: number | null) => value === null ? "Unavailable" : `$${value.toFixed(6)}`;
export function ResearchMetrics({ metrics }: { metrics?: Metrics }) {
  if (!metrics) return null;
  return <section aria-label="Run metrics">
    <dl className="research-metrics">
      <div><dt>Tool calls</dt><dd>{metrics.toolCalls} <small>({metrics.documentCalls} reads + {metrics.modelCalls} model)</small></dd></div>
      <div><dt>Tokens in</dt><dd>{count(metrics.tokensIn)}</dd></div>
      <div><dt>Tokens out</dt><dd>{count(metrics.tokensOut)}</dd></div>
      <div><dt>Context</dt><dd>{metrics.contextCharacters.toLocaleString()} characters <small>≈ {metrics.contextEstimatedTokens.toLocaleString()} tokens, estimated</small></dd></div>
      <div><dt>Wall-clock time</dt><dd>{(metrics.wallclockMs / 1000).toFixed(2)}s</dd></div>
      <div><dt>Total model cost</dt><dd>{usd(metrics.totalCostUsd)} <small>({metrics.costSource})</small></dd></div>
      <div><dt>Cost per credit</dt><dd>{usd(metrics.costPerCreditUsd)} <small>{metrics.costPerCreditUsd === null ? "No credit conversion configured" : "configured USD / credit"}</small></dd></div>
      <div><dt>Credits used</dt><dd>{metrics.creditsUsed === null ? "Unavailable" : metrics.creditsUsed.toFixed(4)}</dd></div>
    </dl>
    <p className="field-hint">Tool calls count attempted document reads and model requests, including failures; redirect hops are part of the same read. Context is the source/candidate payload, excluding the system prompt. Costs exclude hosting/network fees. Credit conversion is configuration-based.</p>
  </section>;
}
