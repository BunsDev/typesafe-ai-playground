import type { Chess } from "chess.js";
import { legalMoves, materialBalance, phaseOf } from "./chessEngine";
import type { MoveCandidate, PositionSummary } from "../types/chess";
/**
 * Compresses a position into the nine fields Jev is given.
 *
 * What is deliberately absent matters more than what is here: no piece
 * placement, no pawn structure, no king safety, no threats, no history beyond
 * the opponent's last move. A classifier can act on this; a chess player
 * cannot. That gap is the demo.
 */
export function buildPositionSummary(
  game: Chess,
  candidates: MoveCandidate[] = legalMoves(game),
): PositionSummary {
  const mover = game.turn();
  const history = game.history();
  return {
    side_to_move: mover === "w" ? "white" : "black",
    move_number: game.moveNumber(),
    material_balance: materialBalance(game, mover),
    in_check: game.isCheck(),
    legal_move_count: candidates.length,
    captures_available: candidates.filter((move) => !!move.captured).length,
    checks_available: candidates.filter((move) => move.gives_check).length,
    phase: phaseOf(game),
    last_opponent_move: history.at(-1) ?? "none",
  };
}
