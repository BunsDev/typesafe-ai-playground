"use client";
import { Flag } from "lucide-react";
import { percent } from "../lib/client";
import {
  modeLabels,
  outcomeLabels,
  reasonLabels,
  type GameMode,
  type GameSummary,
} from "../types/chess";
/**
 * End-of-game totals for Jev's side. The opponent is the control, so nothing
 * here is measured about it — the question is only ever how badly Jev did
 * against a known floor.
 */
export function ResultSummary({
  summary,
  mode,
  blunderCp,
  refereeDepth,
}: {
  summary: GameSummary;
  mode: GameMode;
  blunderCp: number;
  refereeDepth: number;
}) {
  const material = summary.finalMaterial;
  return (
    <section className="panel chess-result">
      <div className="panel-heading">
        <div>
          <Flag size={15} />
          <h2>
            {outcomeLabels[summary.outcome]}
            {summary.reason !== "none" && ` by ${reasonLabels[summary.reason]}`}
          </h2>
        </div>
        <span className="muted">{modeLabels[mode]}</span>
      </div>
      <div className="chess-stats">
        <div>
          <span>Blunders</span>
          <strong>{summary.blunders}</strong>
          <small>
            of {summary.jevMoves} moves ({percent(summary.blunderRate)})
          </small>
        </div>
        <div>
          <span>Mean material lost</span>
          <strong>
            {Math.round(summary.meanLossCp)}
            <small>cp</small>
          </strong>
          <small>worst {summary.worstLossCp}cp</small>
        </div>
        <div>
          <span>Mean confidence</span>
          <strong>{percent(summary.meanConfidence)}</strong>
          <small>across Jev&rsquo;s moves</small>
        </div>
        <div>
          <span>Final material</span>
          <strong>
            {material > 0 ? `+${material}` : material}
            <small>cp</small>
          </strong>
          <small>{material < 0 ? "down" : material > 0 ? "up" : "level"}</small>
        </div>
        <div>
          <span>Mean latency</span>
          <strong>
            {Math.round(summary.meanLatencyMs)}
            <small>ms</small>
          </strong>
          <small>per decision</small>
        </div>
        <div>
          <span>Illegal picks</span>
          <strong>{summary.illegalAttempts}</strong>
          <small>fell back to argmax</small>
        </div>
      </div>
      {(summary.matesAllowed > 0 || summary.matesMissed > 0) && (
        <p className="panel-footnote">
          Counted apart from the centipawn figures:{" "}
          {summary.matesAllowed > 0 &&
            `${summary.matesAllowed} ${summary.matesAllowed === 1 ? "move" : "moves"} walked into a forced mate`}
          {summary.matesAllowed > 0 && summary.matesMissed > 0 && ", and "}
          {summary.matesMissed > 0 &&
            `${summary.matesMissed} missed a mate that was available`}
          . A mate score is not a material count, so it is never averaged in.
        </p>
      )}
      <p className="panel-footnote">
        A move counts as a blunder when it gives away {blunderCp} centipawns or
        more against the best move the depth-{refereeDepth} referee found, or
        when it walks into mate. The referee is the same minimax engine offered
        as an opponent — Jev is being marked against the cheapest search there
        is, not a strong one.
      </p>
      {summary.failures > 0 && (
        <p className="panel-footnote">
          {summary.failures} request{summary.failures === 1 ? "" : "s"} failed
          and {summary.failures === 1 ? "is" : "are"} excluded from the latency
          and confidence figures.
        </p>
      )}
    </section>
  );
}
