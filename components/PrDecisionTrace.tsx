"use client";
import { useState } from "react";
import type { RoutedReview, Thresholds } from "../src/pr-review/types";
import { percent } from "../lib/client";
export function PrDecisionTrace({
  results,
  pending,
  thresholds,
  onInspect,
}: {
  results: RoutedReview[];
  pending: number;
  thresholds: Thresholds;
  onInspect: (id: string) => void;
}) {
  const [all, setAll] = useState(false);
  const priority = [...results].sort(
    (a, b) =>
      Number(b.decision === "block_candidate") -
        Number(a.decision === "block_candidate") ||
      Number(a.route === "skip") - Number(b.route === "skip"),
  );
  const rows = all ? priority : priority.slice(0, 3);
  return (
    <section className="pr-decision-trace">
      <div className="trace-heading">
        <h3>Why this decision</h3>
        <span className="type-badge">Evidence → labels → gates → route</span>
      </div>
      <p>
        One high-risk hunk can hold the PR. Approval requires every hunk to
        pass; incomplete or uncertain results remain in review.
      </p>
      <div className="trace-thresholds">
        <span>
          Safe skip ≥ <b>{percent(thresholds.safe)}</b>
        </span>
        <span>
          High-risk hold ≥ <b>{percent(thresholds.risk)}</b>
        </span>
        <span>
          Low confidence &lt; <b>{percent(thresholds.minimum)}</b>
        </span>
      </div>
      {pending > 0 && (
        <p className="trace-pending">
          {pending} pending {pending === 1 ? "hunk prevents" : "hunks prevent"}{" "}
          approval.
        </p>
      )}
      {rows.map((r) => {
        const labels = r.result.decisions.filter((d) => d.selected === d.label);
        return (
          <article
            className={"trace-row trace-" + r.route}
            key={r.result.hunk.id}
          >
            <div className="trace-row-title">
              <strong>{r.result.hunk.path}</strong>
              <span className="type-badge">
                {r.route === "human"
                  ? "Human review"
                  : r.route === "llm"
                    ? "LLM review"
                    : "Skip expensive review"}
              </span>
            </div>
            <div className="trace-labels">
              {labels.length ? (
                labels.map((d) => (
                  <span key={d.label}>
                    {d.label.replaceAll("_", " ")} <b>{percent(d.certainty)}</b>
                  </span>
                ))
              ) : (
                <span>No confident positive label</span>
              )}
            </div>
            <p>{r.reason}</p>
            <button
              className="button quiet"
              onClick={() => onInspect(r.result.hunk.id)}
              aria-label={`Inspect evidence for ${r.result.hunk.path} line ${r.result.hunk.newStart}`}
            >
              Trace to line {r.result.hunk.newStart} →
            </button>
          </article>
        );
      })}
      {priority.length > 3 && (
        <button className="button quiet" onClick={() => setAll(!all)}>
          {all
            ? "Show priority hunks"
            : `Show all ${priority.length} hunk routes`}
        </button>
      )}
      <p className="trace-note">
        Scores use the lower of confidence and probability. These are routing
        signals, not proof of a bug. No review or GitHub action is submitted
        automatically.
      </p>
    </section>
  );
}
export function HunkDecisionTrace({
  routed,
  thresholds,
}: {
  routed: RoutedReview;
  thresholds: Thresholds;
}) {
  const r = routed.result;
  const all = [...r.decisions, r.rule];
  const minimum = all.some((d) => d.certainty === null)
    ? null
    : Math.min(...all.map((d) => d.certainty!));
  return (
    <section className="hunk-gate-trace">
      <h4>How this hunk was routed</h4>
      <ol>
        <li>
          <strong>Source evidence</strong>
          <span>
            {r.hunk.complete
              ? "Complete hunk retained"
              : "Incomplete hunk — cannot skip review"}{" "}
            ·{" "}
            {r.source === "mock"
              ? "mock predictions"
              : r.source === "jev"
                ? "live Jev predictions"
                : "not classified"}
          </span>
        </li>
        <li>
          <strong>Classification certainty</strong>
          <span>
            Lowest score across label and rule decisions: {percent(minimum)}.
            Safe skipping requires every score ≥ {percent(thresholds.safe)}.
          </span>
        </li>
        <li>
          <strong>Policy checks</strong>
          <span>
            {r.candidates.protected
              ? "Protected path requires human review. "
              : "No protected-path rule. "}
            {r.candidates.testsRequired
              ? "Test coverage must be verified."
              : "No explicit test requirement."}
          </span>
        </li>
        <li>
          <strong>
            Final route:{" "}
            {routed.route === "skip"
              ? "skip expensive review"
              : routed.route === "human"
                ? "human review"
                : "LLM review"}
          </strong>
          <span>{routed.reason}</span>
        </li>
      </ol>
    </section>
  );
}
