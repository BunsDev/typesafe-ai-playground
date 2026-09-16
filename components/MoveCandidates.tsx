"use client";
import {
  pieceNames,
  summaryFields,
  type MoveCandidate,
  type PositionSummary,
} from "../types/chess";
/**
 * The exact request Jev was given for one ply: the nine-field summary, and the
 * legal moves it was allowed to choose between.
 *
 * Both halves are shown verbatim because the page's whole claim rests on them —
 * if Jev plays badly, the reader should be able to see that it was working from
 * a position description with no board in it.
 */
const show = (value: PositionSummary[keyof PositionSummary]) =>
  typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
export function MoveCandidates({
  summary,
  candidates,
  chosen,
  best,
}: {
  summary: PositionSummary;
  candidates: MoveCandidate[];
  chosen?: string;
  best?: string;
}) {
  return (
    <div className="chess-request">
      <div className="chess-summary">
        <h3>What Jev was told about the position</h3>
        <dl>
          {summaryFields.map((field) => (
            <div key={field}>
              <dt>{field}</dt>
              <dd>{show(summary[field])}</dd>
            </div>
          ))}
        </dl>
        <p className="muted">
          Nine fields. No piece placement, no squares, no threats, no plan from
          the move before — the board itself is never sent.
        </p>
      </div>
      <div className="chess-candidates">
        <h3>
          Legal moves offered <span className="count">{candidates.length}</span>
        </h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Move</th>
                <th>Piece</th>
                <th>Captures</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr
                  key={candidate.san}
                  className={[
                    candidate.san === chosen ? "chosen" : "",
                    candidate.san === best ? "best" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <td>
                    <code>{candidate.san}</code>
                    {candidate.san === chosen && (
                      <span className="tag">played</span>
                    )}
                    {candidate.san === best && candidate.san !== chosen && (
                      <span className="tag best-tag">best</span>
                    )}
                  </td>
                  <td>{pieceNames[candidate.piece] ?? candidate.piece}</td>
                  <td>
                    {candidate.captured
                      ? `${pieceNames[candidate.captured] ?? candidate.captured} (+${candidate.material_gain})`
                      : "—"}
                  </td>
                  <td>
                    {candidate.gives_mate
                      ? "mate"
                      : candidate.gives_check
                        ? "check"
                        : candidate.promotion
                          ? `promotes to ${pieceNames[candidate.promotion]}`
                          : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
