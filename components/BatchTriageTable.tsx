"use client";
import { Flame } from "lucide-react";
import { percent } from "../lib/client";
import { tally } from "../lib/batchTriage";
import { resolveTriage } from "../lib/classifyQuestionWithJev";
import { OutcomeBadge } from "./TriageResult";
import { ErrorNote } from "./ui";
import type { BatchRow } from "../types/triage";
export function BatchTriageTable({
  rows,
  threshold,
}: {
  rows: BatchRow[];
  threshold: number;
}) {
  const decisions = rows.map((row) =>
    row.response
      ? resolveTriage(row.response, row.candidates, threshold)
      : undefined,
  );
  const meter = tally(decisions);
  return (
    <>
      <div className="annoyance-meter">
        <Flame size={20} />
        <div>
          <span className="eyebrow">
            Questions that could have been avoided
          </span>
          <strong>
            {meter.avoidable} <span>of {meter.total}</span>
          </strong>
          <p>
            {meter.label} · {meter.needsHuman} for a human · {meter.unclear} too
            vague
          </p>
        </div>
        <div className="probability-track">
          <span style={{ width: percent(meter.ratio) }} />
        </div>
      </div>
      <div className="table-wrap batch-table">
        <table>
          <caption>
            Each question is gated against only the messages above it.
          </caption>
          <thead>
            <tr>
              <th>Question</th>
              <th>Decision</th>
              <th>Confidence</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const decision = decisions[index];
              return (
                <tr key={row.index}>
                  <td>
                    <strong>{row.message.speaker}</strong>
                    {row.message.timestamp && (
                      <time> {row.message.timestamp}</time>
                    )}
                    <p>{row.message.content}</p>
                  </td>
                  <td>
                    {row.error ? (
                      <ErrorNote message={row.error} />
                    ) : decision ? (
                      <>
                        <OutcomeBadge outcome={decision.outcome} />
                        <p className="muted">{decision.reason}</p>
                      </>
                    ) : (
                      <span className="muted">Waiting…</span>
                    )}
                  </td>
                  <td>{decision ? percent(decision.confidence) : "—"}</td>
                  <td>
                    {decision?.evidence ? (
                      <>
                        <blockquote>{decision.evidence.excerpt}</blockquote>
                        <span className="muted">
                          {decision.evidence.id} · {decision.evidence.label}
                        </span>
                      </>
                    ) : (
                      <span className="null-value">none cited</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
