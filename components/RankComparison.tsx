import { CandidateTable } from "./CandidateTable";
import type { RankingRun } from "../types/rerank";
export function RankComparison({
  vector,
  showVectorTiming,
  jev,
  baseline,
  flagged,
  onInspect,
}: {
  vector: RankingRun;
  showVectorTiming: boolean;
  jev: RankingRun | null;
  baseline: RankingRun | null;
  flagged: Set<string>;
  onInspect: (id: string) => void;
}) {
  return (
    <div className="rank-comparison">
      {[
        {
          title: "Original vector order",
          detail: "Similarity from your input",
          run: vector,
        },
        {
          title: "Jev reranked",
          detail: "Closed-set relevance classification",
          run: jev,
        },
        {
          title: "Baseline · lexical mock",
          detail: "Token overlap, not a cross-encoder",
          run: baseline,
        },
      ].map(({ title, detail, run }) => (
        <section className="panel rank-column" key={title} aria-label={title}>
          <div className="rank-column-heading">
            <h2>{title}</h2>
            <p className="muted">{detail}</p>
            <span>
              {run?.method === "vector" && !showVectorTiming
                ? "Measuring sort…"
                : run
                  ? run.latencyMs.toFixed(1) + " ms"
                  : "Not run"}
            </span>
          </div>
          <CandidateTable run={run} flagged={flagged} onInspect={onInspect} />
        </section>
      ))}
    </div>
  );
}
