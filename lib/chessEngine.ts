import { Chess } from "chess.js";
import {
  pieceNames,
  pieceValues,
  type EndReason,
  type GameOutcome,
  type GamePhase,
  type MoveCandidate,
} from "../types/chess";
/**
 * Every rule of chess lives behind this file. Jev is never asked whether a move
 * is legal, which squares a bishop reaches, or when a game is over — the engine
 * answers all of that, and Jev only ever picks from what it returns.
 */
export const newGame = () => new Chess();
export const gameFrom = (fen: string) => new Chess(fen);
/** Centipawn material balance from `color`'s point of view. */
export function materialBalance(game: Chess, color: "w" | "b"): number {
  let total = 0;
  for (const row of game.board())
    for (const square of row) {
      if (!square) continue;
      const value = pieceValues[square.type] ?? 0;
      total += square.color === color ? value : -value;
    }
  return total;
}
/** Total non-king material on the board, used only to name the phase. */
export function remainingMaterial(game: Chess): number {
  let total = 0;
  for (const row of game.board())
    for (const square of row)
      if (square && square.type !== "k") total += pieceValues[square.type] ?? 0;
  return total;
}
export function phaseOf(game: Chess): GamePhase {
  const left = remainingMaterial(game);
  if (left > 6000) return "opening";
  if (left > 2400) return "middlegame";
  return "endgame";
}
/**
 * The legal moves for the side to move, in the engine's own order, each
 * annotated with the facts Jev is allowed to see about it. `gives_mate` and
 * `gives_check` come from actually playing the move, not from guessing.
 */
export function legalMoves(game: Chess): MoveCandidate[] {
  return game.moves({ verbose: true }).map((move) => {
    const probe = new Chess(move.after);
    return {
      san: move.san,
      from: move.from,
      to: move.to,
      piece: move.piece,
      ...(move.captured ? { captured: move.captured } : {}),
      ...(move.promotion ? { promotion: move.promotion } : {}),
      gives_check: probe.isCheck(),
      gives_mate: probe.isCheckmate(),
      material_gain:
        (move.captured ? (pieceValues[move.captured] ?? 0) : 0) +
        (move.promotion
          ? (pieceValues[move.promotion] ?? 0) - pieceValues.p
          : 0),
    };
  });
}
/**
 * One line of plain English per candidate, which becomes the Choice criteria.
 * This is everything Jev learns about a move — no square colours, no threats it
 * creates, no idea what the opponent can do next.
 */
export function describeCandidate(move: MoveCandidate): string {
  const parts = [
    `Move the ${pieceNames[move.piece] ?? move.piece} from ${move.from} to ${move.to}.`,
  ];
  if (move.captured)
    parts.push(
      `Captures a ${pieceNames[move.captured] ?? move.captured} worth ${pieceValues[move.captured] ?? 0} centipawns.`,
    );
  else parts.push("Captures nothing.");
  if (move.promotion)
    parts.push(
      `Promotes to a ${pieceNames[move.promotion] ?? move.promotion}.`,
    );
  if (move.gives_mate) parts.push("Delivers checkmate and wins immediately.");
  else if (move.gives_check) parts.push("Gives check.");
  return parts.join(" ");
}
/**
 * Rebuilds a game by replaying its moves.
 *
 * A position is not the same thing as a game: `new Chess(fen)` throws away the
 * move history, and with it threefold repetition and the opponent's last move.
 * The move list is therefore the canonical state everywhere in this workspace,
 * and a Chess object is only ever derived from it. Replaying a full game costs
 * a few milliseconds.
 */
export function replay(sans: string[], startFen?: string): Chess {
  const game = startFen ? new Chess(startFen) : new Chess();
  for (const san of sans) game.move(san);
  return game;
}
/**
 * A copy that keeps its history, unlike `new Chess(game.fen())`.
 *
 * Reads back the setup position from the PGN headers so a game built from a
 * FEN clones as itself rather than silently resetting to the opening. The app
 * only ever starts from the standard position; tests and fixtures do not.
 */
export const cloneGame = (game: Chess): Chess =>
  replay(game.history(), game.getHeaders().FEN);
/** Plays a move by its SAN. Throws when the move is not legal. */
export function applyMove(game: Chess, san: string): Chess {
  const next = cloneGame(game);
  next.move(san);
  return next;
}
export interface Ending {
  over: boolean;
  outcome: GameOutcome;
  reason: EndReason;
}
/**
 * Reads the end of the game from the rules engine. `jevColor` decides which
 * result counts as a win, so the summary never has to guess which side we were
 * rooting for.
 */
export function endingOf(game: Chess, jevColor: "w" | "b"): Ending {
  if (game.isCheckmate())
    return {
      over: true,
      // The side to move is the one that has been mated.
      outcome: game.turn() === jevColor ? "opponent_win" : "jev_win",
      reason: "checkmate",
    };
  if (game.isStalemate())
    return { over: true, outcome: "draw", reason: "stalemate" };
  if (game.isInsufficientMaterial())
    return { over: true, outcome: "draw", reason: "insufficient_material" };
  if (game.isThreefoldRepetition())
    return { over: true, outcome: "draw", reason: "threefold_repetition" };
  if (game.isDraw())
    return { over: true, outcome: "draw", reason: "fifty_move_rule" };
  return { over: false, outcome: "in_progress", reason: "none" };
}
/** A tiny deterministic PRNG, so a seeded game replays move for move. */
export function rng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}
