"use client";
import { AlertTriangle, Timer } from "lucide-react";
import { percent } from "../lib/client";
import { sourceLabels, type MoveRecord } from "../types/chess";
/**
 * Jev's distribution over the legal moves for one ply, plus what the referee
 * made of the move that was actually played.
 *
 * The two halves sit together on purpose: a high-confidence pick next to a
 * 500-centipawn loss is the clearest single statement this page can make.
 */
export function MoveProbabilities({ move }: { move: MoveRecord }) {
  const entries = Object.entries(move.probabilities ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const top = entries.slice(0, 8);
  const hidden = entries.length - top.length;
  return (
    <div className="chess-decision">
      <div className="chess-verdict" data-blunder={move.blunder ? "yes" : "no"}>
        <div>
          <span className="eyebrow">Move played</span>
          <strong>
            <code>{move.san}</code>
          </strong>
          <p className="muted">{sourceLabels[move.source]}</p>
        </div>
        <div className="chess-verdict-stats">
          <div>
            <span>Confidence</span>
            <strong>
              {typeof move.confidence === "number"
                ? percent(move.confidence)
                : "—"}
            </strong>
          </div>
          <div>
            <span>{move.mate ? "Referee" : "Material lost"}</span>
            <strong>
              {move.mate
                ? move.walkedIntoMate
                  ? "allows mate"
                  : "missed mate"
                : move.lossCp === null
                  ? "—"
                  : `${move.lossCp} cp`}
            </strong>
          </div>
          <div>
            <span>
              <Timer size={11} /> Latency
            </span>
            <strong>
              {typeof move.latencyMs === "number"
                ? `${Math.round(move.latencyMs)} ms`
                : "—"}
            </strong>
          </div>
        </div>
      </div>
      {move.blunder && (
        <p className="chess-blunder" role="status">
          <AlertTriangle size={14} />
          {move.mate
            ? move.walkedIntoMate
              ? "This move walks into a forced mate."
              : "A forced mate was available and this move is not it."
            : `Minimax found ${move.bestSan} instead, worth ${move.lossCp} centipawns more.`}
        </p>
      )}
      {top.length ? (
        <ul className="action-bars">
          {top.map(([san, score]) => (
            <li key={san} className={san === move.san ? "taken" : ""}>
              <span>
                <code>{san}</code>
              </span>
              <span className="probability-track">
                <span
                  style={{
                    width: `${Math.max(0, Math.min(1, score)) * 100}%`,
                  }}
                />
              </span>
              <span className="count">{percent(score)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No probabilities came back for this move.</p>
      )}
      {hidden > 0 && (
        <p className="panel-footnote">
          {hidden} further scored {hidden === 1 ? "move" : "moves"} not shown.
        </p>
      )}
      {move.error && (
        <p className="error-text" role="alert">
          {move.error}
        </p>
      )}
    </div>
  );
}
