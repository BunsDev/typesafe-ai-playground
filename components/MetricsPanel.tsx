import { compareRankings } from "../lib/compareRankings";
import type { RankingRun } from "../types/rerank";
export function MetricsPanel({
  jev,
  baseline,
  unitCost,
}: {
  jev: RankingRun | null;
  baseline: RankingRun | null;
  unitCost: number;
}) {
  const metrics = jev && baseline ? compareRankings(jev, baseline) : null;
  return (
    <section className="panel rerank-metrics" aria-label="Comparison metrics">
      <div>
        <span>Top-{metrics?.k ?? 10} overlap</span>
        <strong>
          {metrics ? (metrics.overlap * 100).toFixed(0) + "%" : "—"}
        </strong>
        <small>Shared results, not accuracy</small>
      </div>
      <div>
        <span>Rank correlation</span>
        <strong>{metrics ? metrics.correlation.toFixed(3) : "—"}</strong>
        <small>−1 opposite · +1 same order</small>
      </div>
      <div>
        <span>Jev requests</span>
        <strong>{jev?.requests ?? "—"}</strong>
        <small>10 candidates per request · 3 parallel</small>
      </div>
      <div>
        <span>Estimated Jev cost</span>
        <strong>
          {jev && unitCost > 0
            ? "$" + (jev.requests * unitCost).toFixed(4)
            : "Not set"}
        </strong>
        <small>Your unit price · baseline $0 API cost</small>
      </div>
      <p className="muted">
        Comparison requires every candidate to be scored. Correlation uses
        displayed positions; ties use vector score, then input order. Latencies
        are measured locally, including network time for Jev. Vector latency
        measures sorting only, not retrieval. Costs exclude hosting and compute.
      </p>
    </section>
  );
}
