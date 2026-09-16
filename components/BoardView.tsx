"use client";
import { pieceGlyphs } from "../types/chess";
import { replay } from "../lib/chessEngine";
/**
 * The board, drawn from the move list rather than a FEN so the position always
 * matches the game the rest of the page is describing.
 *
 * Hand-rolled rather than pulled from a chessboard package: the repo draws its
 * other viewports (the Doom arena, the MicroDuck grid) as plain SVG in the same
 * way, and click-to-move is all the interaction this needs — no drag-and-drop,
 * and no second dependency tree behind it.
 */
const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
export function BoardView({
  sans,
  lastMove,
  selected,
  targets = [],
  onSquare,
  interactive = false,
}: {
  sans: string[];
  lastMove?: { from: string; to: string };
  selected?: string | null;
  targets?: string[];
  onSquare?: (square: string) => void;
  interactive?: boolean;
}) {
  const game = replay(sans);
  const board = game.board();
  const targetSet = new Set(targets);
  const inCheck = game.isCheck();
  const kingColor = game.turn();
  const description = board
    .flat()
    .filter((square): square is NonNullable<typeof square> => !!square)
    .map(
      (square) =>
        `${square.color === "w" ? "White" : "Black"} ${square.type} on ${square.square}`,
    )
    .join(", ");
  return (
    <div className="chess-board-wrap">
      <div
        className="chess-board"
        role="grid"
        aria-label={`Chess position after ${sans.length} half-moves. ${description}.`}
      >
        {ranks.map((rank, row) => (
          <div className="chess-rank" role="row" key={rank}>
            {files.map((file, column) => {
              const square = `${file}${rank}`;
              const piece = board[row][column];
              const dark = (row + column) % 2 === 1;
              const isKingInCheck =
                inCheck && piece?.type === "k" && piece.color === kingColor;
              const classes = [
                "chess-square",
                dark ? "dark" : "light",
                selected === square ? "selected" : "",
                targetSet.has(square) ? "target" : "",
                lastMove?.from === square || lastMove?.to === square
                  ? "last-move"
                  : "",
                isKingInCheck ? "in-check" : "",
              ]
                .filter(Boolean)
                .join(" ");
              const label = piece
                ? `${square}, ${piece.color === "w" ? "white" : "black"} ${piece.type}`
                : `${square}, empty`;
              return interactive && onSquare ? (
                <button
                  type="button"
                  role="gridcell"
                  key={square}
                  className={classes}
                  data-square={square}
                  aria-label={label}
                  aria-pressed={selected === square}
                  onClick={() => onSquare(square)}
                >
                  {piece ? (
                    <span className={`piece ${piece.color}`} aria-hidden="true">
                      {pieceGlyphs[piece.color][piece.type]}
                    </span>
                  ) : targetSet.has(square) ? (
                    <span className="dot" aria-hidden="true" />
                  ) : null}
                </button>
              ) : (
                <div
                  role="gridcell"
                  key={square}
                  className={classes}
                  data-square={square}
                  aria-label={label}
                >
                  {piece && (
                    <span className={`piece ${piece.color}`} aria-hidden="true">
                      {pieceGlyphs[piece.color][piece.type]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="chess-files" aria-hidden="true">
        {files.map((file) => (
          <span key={file}>{file}</span>
        ))}
      </div>
    </div>
  );
}
