import { Chess } from "chess.js";
import { materialBalance } from "./chessEngine";
/**
 * A deliberately small engine: negamax over material only, no quiescence, no
 * piece-square tables, no opening book. Two or three hundred lines of chess
 * knowledge at most.
 *
 * It has two jobs in this workspace, and the second is the interesting one:
 *
 *   1. It plays Black in "Jev vs Minimax", so Jev has a floor to lose to.
 *   2. It is the *referee*. Every Jev move is scored against the best move this
 *      engine can find from the same position, and the difference in
 *      centipawns is what the page calls a blunder.
 *
 * Using one evaluator for both is the honest version of the comparison: Jev is
 * not being marked against a grandmaster, it is being marked against the
 * cheapest possible search — the thing it is supposed to be a poor substitute
 * for.
 */
export const MATE = 100000;
/**
 * Mate scores are not centipawns and must never be averaged with them: a move
 * that allows mate-in-one scores -100000, and folding that into a "mean
 * material lost" figure produces a meaningless 33,000cp average. The page
 * counts mate separately instead.
 */
export const isMateScore = (score: number) => Math.abs(score) > MATE / 2;
/** Evaluates from the point of view of the side to move. */
function evaluate(game: Chess): number {
  if (game.isCheckmate()) return -MATE;
  if (game.isDraw() || game.isStalemate() || game.isInsufficientMaterial())
    return 0;
  return materialBalance(game, game.turn());
}
/**
 * Negamax with alpha-beta. Depth is in plies and stays small on purpose — the
 * page offers 1 to 3, and even depth 2 is enough to beat a move-at-a-time
 * classifier convincingly.
 */
function negamax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (depth <= 0 || game.isGameOver()) return evaluate(game);
  const moves = game.moves({ verbose: true });
  if (!moves.length) return evaluate(game);
  // Captures first: with alpha-beta this cuts the tree enough to keep a depth-3
  // search inside a browser frame budget.
  const ordered = [...moves].sort(
    (a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0),
  );
  let best = -Infinity;
  for (const move of ordered) {
    const score = -negamax(new Chess(move.after), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
export interface ScoredMove {
  san: string;
  score: number;
}
/**
 * Scores every legal move from the side to move's point of view. Ordering is
 * the engine's own move order, so a seeded game replays identically.
 */
export function scoreMoves(game: Chess, depth: number): ScoredMove[] {
  return game.moves({ verbose: true }).map((move) => ({
    san: move.san,
    score: -negamax(
      new Chess(move.after),
      Math.max(0, depth - 1),
      -Infinity,
      Infinity,
    ),
  }));
}
/**
 * The engine's own move.
 *
 * Ties are broken by the seeded PRNG rather than by move-generation order. A
 * material-only evaluator scores every opening move identically, and taking the
 * first one makes the engine open 1.a3 every single game — which reads as a
 * broken opponent rather than a simple one. Random tie-breaking keeps the
 * evaluation honestly material-only while letting the games differ; the seed
 * keeps them reproducible.
 */
export function minimaxMove(
  game: Chess,
  depth: number,
  random?: () => number,
): string | null {
  const scored = scoreMoves(game, depth);
  if (!scored.length) return null;
  const best = Math.max(...scored.map((move) => move.score));
  const tied = scored.filter((move) => move.score === best);
  if (!random || tied.length === 1) return tied[0].san;
  return tied[Math.min(tied.length - 1, Math.floor(random() * tied.length))]
    .san;
}
export interface Judgement {
  /**
   * Centipawns given away versus the best move the referee found. Meaningful
   * only when `mate` is false — see `isMateScore`.
   */
  lossCp: number;
  bestSan: string;
  playedScore: number;
  bestScore: number;
  /** The played move walks into a forced mate, or throws one away. */
  mate: boolean;
  /** The played move allows the opponent to mate. */
  walkedIntoMate: boolean;
  /** A mate was available and the played move is not it. */
  missedMate: boolean;
}
/**
 * Marks one played move against the best available. A positive `lossCp` is
 * material the mover threw away; the page treats anything at or above the
 * blunder threshold as a blunder.
 *
 * Returns null when the position has nothing to judge — no legal moves, or the
 * played move is not among them.
 */
export function judgeMove(
  game: Chess,
  san: string,
  depth: number,
): Judgement | null {
  const scored = scoreMoves(game, depth);
  if (!scored.length) return null;
  const played = scored.find((move) => move.san === san);
  if (!played) return null;
  let best = scored[0];
  for (const move of scored) if (move.score > best.score) best = move;
  const walkedIntoMate = isMateScore(played.score) && played.score < 0;
  const missedMate =
    isMateScore(best.score) && best.score > 0 && played.score !== best.score;
  return {
    lossCp: Math.max(0, best.score - played.score),
    bestSan: best.san,
    playedScore: played.score,
    bestScore: best.score,
    mate: walkedIntoMate || missedMate,
    walkedIntoMate,
    missedMate,
  };
}
/** The floor every run is measured against: a uniform pick over legal moves. */
export function randomMove(game: Chess, random: () => number): string | null {
  const moves = game.moves();
  if (!moves.length) return null;
  return moves[Math.min(moves.length - 1, Math.floor(random() * moves.length))];
}
