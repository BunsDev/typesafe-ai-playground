"use client";
import { JEV_COLOR } from "../lib/chessGameLoop";
import type { MoveRecord } from "../types/chess";
/**
 * The move history, one row per full move, with Jev's half marked up by how the
 * referee scored it. Clicking a Jev ply opens that decision in the panel above.
 */
export function GameLog({
  moves,
  selected,
  onSelect,
}: {
  moves: MoveRecord[];
  selected: number | null;
  onSelect: (ply: number) => void;
}) {
  const rows: { number: number; white?: MoveRecord; black?: MoveRecord }[] = [];
  for (const move of moves) {
    const number = Math.floor((move.ply - 1) / 2) + 1;
    let row = rows.find((candidate) => candidate.number === number);
    if (!row) {
      row = { number };
      rows.push(row);
    }
    if (move.color === "w") row.white = move;
    else row.black = move;
  }
  const cell = (move?: MoveRecord) => {
    if (!move) return <td />;
    const isJev = move.color === JEV_COLOR;
    const classes = [
      isJev ? "jev-ply" : "",
      move.blunder ? "blunder" : "",
      selected === move.ply ? "selected" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <td className={classes}>
        {isJev ? (
          <button type="button" onClick={() => onSelect(move.ply)}>
            <code>{move.san}</code>
            {move.blunder && (
              <span className="tag blunder-tag">
                {move.mate ? "mate" : `−${move.lossCp}`}
              </span>
            )}
          </button>
        ) : (
          <code>{move.san}</code>
        )}
      </td>
    );
  };
  return (
    <div className="table-scroll chess-log">
      <table>
        <caption>
          {moves.length} {moves.length === 1 ? "half-move" : "half-moves"}{" "}
          played. Jev is White; click any of its moves to inspect the decision.
        </caption>
        <thead>
          <tr>
            <th>#</th>
            <th>Jev (white)</th>
            <th>Opponent (black)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.number}>
              <td className="move-number">{row.number}</td>
              {cell(row.white)}
              {cell(row.black)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
