import type { RankingRun } from "../types/rerank";
export function CandidateTable({
  run,
  flagged,
  onInspect,
}: {
  run: RankingRun | null;
  flagged: Set<string>;
  onInspect: (id: string) => void;
}) {
  if (!run)
    return (
      <div className="rerank-empty">Run this method to see its ranking.</div>
    );
  return (
    <ol className="rerank-list">
      {run.candidates.map((c, i) => (
        <li key={c.id} className={flagged.has(c.id) ? "rank-disagreement" : ""}>
          <span className="rank-position">{i + 1}</span>
          <div>
            <button className="rank-id" onClick={() => onInspect(c.id)}>
              {c.id}
            </button>
            <p>{c.text}</p>
            <div className="rank-scores">
              <span>
                Vector <strong>{c.vectorScore.toFixed(3)}</strong>
              </span>
              {run.method !== "vector" && (
                <span>
                  {run.method === "jev" ? "Relevance" : "Lexical"}{" "}
                  <strong>
                    {c.score === null ? "Unscored" : c.score.toFixed(3)}
                  </strong>
                </span>
              )}
              {run.method === "jev" && (
                <span>
                  Confidence{" "}
                  <strong>
                    {c.confidence === null
                      ? "—"
                      : (c.confidence * 100).toFixed(0) + "%"}
                  </strong>
                </span>
              )}
            </div>
            {c.error && <span className="rank-error">{c.error}</span>}
            {c.level === "unknown" && (
              <span className="muted">Needs more context</span>
            )}
            {flagged.has(c.id) && (
              <button className="rank-flag" onClick={() => onInspect(c.id)}>
                Large rank difference · inspect
              </button>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
