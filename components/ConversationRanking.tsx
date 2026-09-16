"use client";
import { useState } from "react";
import { Trophy, Quote, Check } from "lucide-react";
import * as lab from "../web/conversation";
import { rankConversationRows } from "../lib/conversation-ranking";
import { percent } from "../lib/client";
import { ErrorNote } from "./ui";
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase();
function MessagePreview({
  row,
  featured = false,
}: {
  row: lab.Row;
  featured?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const message = row.message;
  const long =
    (message?.content.length || 0) > 220 ||
    (message?.content.split("\n").length || 0) > 4;
  return (
    <div className={featured ? "featured-message" : "ranked-message-body"}>
      {featured && <Quote size={18} className="message-quote-icon" />}
      <p
        className={
          !featured && !expanded && long
            ? "message-preview is-clamped"
            : "message-preview"
        }
        tabIndex={featured && long ? 0 : undefined}
      >
        {message?.content ||
          "Original message unavailable for this evaluation."}
      </p>
      {!featured && long && (
        <button
          className="message-expand"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "Read full message"}
        </button>
      )}
    </div>
  );
}
export function ConversationRanking({
  rows,
  threshold,
  contest,
  stale,
}: {
  rows: lab.Row[];
  threshold: number;
  contest: boolean;
  stale: boolean;
}) {
  const selection = lab.pickWinners(rows, threshold / 100);
  const ranked = rankConversationRows(rows);
  const others = contest
    ? ranked.filter((r) => !selection.winners.includes(r.row))
    : ranked;
  return (
    <div className="conversation-ranking">
      {contest && (
        <section
          className={
            "winner-card " +
            (selection.status === "winner" || selection.status === "tie"
              ? "has-winner"
              : "")
          }
        >
          <div className="winner-heading">
            <span className="winner-title">
              <Trophy size={19} />
              {selection.status === "winner"
                ? "Reply to this message"
                : selection.status === "tie"
                  ? "Shared top spot"
                  : selection.status === "none"
                    ? "No reply needed"
                    : "Decision incomplete"}
            </span>
            {stale && <span className="pill">Previous run</span>}
          </div>
          {selection.winners.length ? (
            selection.winners.map((row, i) => (
              <div className="winner-message" key={i}>
                <div className="message-author">
                  <span className="message-avatar winner-avatar">
                    {initials(row.speaker || "Unknown")}
                  </span>
                  <div>
                    <h2>{row.speaker}</h2>
                    <span>
                      {row.message?.timestamp ||
                        "Latest message from this speaker"}
                    </span>
                  </div>
                  <div className="winner-score">
                    <strong>
                      {percent(row.response?.answers.should_respond?.noul)}
                    </strong>
                    <span>reply probability</span>
                  </div>
                </div>
                <MessagePreview row={row} featured />
                <div className="winner-message-footer">
                  <span>
                    <Check size={13} />
                    {selection.status === "tie"
                      ? "Tied highest score"
                      : "Highest reply probability"}
                  </span>
                  <span>
                    {row.response?.answers.frame?.choice?.replaceAll(
                      "_",
                      " ",
                    ) || "Frame unavailable"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="winner-empty-copy">
              <h2>
                {selection.status === "none"
                  ? "Let the conversation flow."
                  : "Some evaluations failed."}
              </h2>
              <p>
                {selection.status === "none"
                  ? "No message reached the " + threshold + "% reply threshold."
                  : "An incomplete run cannot choose a winner. Review the unavailable candidates or run again."}
              </p>
            </div>
          )}
          {selection.winners.length > 0 && (
            <p className="winner-rule">
              {selection.status === "tie"
                ? "These messages share the highest score. No unique winner is selected."
                : "This message has the highest score and clears your " +
                  threshold +
                  "% threshold."}{" "}
              No reply has been sent.
            </p>
          )}
        </section>
      )}
      <div className="ranking-heading">
        <h3>
          {contest && selection.winners.length
            ? "Other messages, ranked"
            : contest
              ? "Candidate ranking"
              : "Context comparison"}
        </h3>
        <span>
          {others.length} {others.length === 1 ? "message" : "messages"}
        </span>
      </div>
      <p className="ranking-note">
        {contest
          ? "Each candidate is the speaker’s latest message, evaluated with only its preceding context. Equal scores share a rank."
          : "The same final message is evaluated with the selected context."}
      </p>
      {others.map(({ row, rank, score, index }) => {
        const verdict = lab.gate(
          row.response?.answers.should_respond,
          threshold / 100,
        );
        const name =
          row.speaker ||
          (row.variant === "context" ? "With context" : "Latest message only");
        return (
          <article
            key={index}
            className={
              "ranked-message decision-row " +
              (verdict === "Unavailable" ? "is-unavailable" : "")
            }
          >
            <div className="ranked-message-header">
              <span className="message-rank">
                {contest && rank ? "#" + rank : contest ? "—" : "A/B"}
              </span>
              <span className="message-avatar">{initials(name)}</span>
              <div className="ranked-author">
                <strong>{name}</strong>
                <time>
                  {row.message?.timestamp ||
                    row.response?.answers.frame?.choice?.replaceAll("_", " ") ||
                    "Evaluation unavailable"}
                </time>
              </div>
              <div className="ranked-score">
                <strong>{percent(score)}</strong>
                <span>
                  {verdict === "Respond"
                    ? "Above threshold"
                    : verdict === "Skip"
                      ? "Below threshold"
                      : "Not ranked"}
                </span>
              </div>
            </div>
            <MessagePreview row={row} />
            {row.error ? (
              <ErrorNote message={row.error} />
            ) : (
              <div
                className="probability-track"
                role="meter"
                aria-label={"Reply probability for " + name}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={score === null ? undefined : score * 100}
              >
                <span
                  style={{ width: score === null ? "0%" : percent(score) }}
                />
              </div>
            )}
          </article>
        );
      })}
      {contest && selection.winners.length > 0 && !others.length && (
        <p className="ranking-note">Every candidate is in the top spot.</p>
      )}
    </div>
  );
}
