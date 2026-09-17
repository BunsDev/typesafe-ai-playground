import type { Chess } from "chess.js";
import { judgeMove, minimaxMove, randomMove } from "./baselineMinimax";
import { buildPositionSummary } from "./buildPositionSummary";
import {
  applyMove,
  endingOf,
  legalMoves,
  materialBalance,
  replay,
} from "./chessEngine";
import {
  type GameMode,
  type GameSummary,
  type MoveCandidate,
  type MoveRecord,
  type MoveSource,
  type PositionSummary,
} from "../types/chess";
/**
 * The turn machinery. Named `chessGameLoop` rather than `gameLoop` because
 * `lib/gameLoop.ts` already belongs to the Doom workspace.
 *
 * Jev always plays White. The opponent is whatever the mode says, and every
 * Jev ply is scored by the minimax referee before the next one begins.
 */
export const JEV_COLOR = "w" as const;
/** Centipawns given away before a move is called a blunder. Two pawns. */
export const BLUNDER_CP = 200;
export interface LoopOptions {
  mode: GameMode;
  depth: number;
  seed: number;
  /** Plies to judge at. Kept separate from `depth` so the referee stays fixed
   *  even when the opponent's strength is dialled up or down. */
  refereeDepth: number;
  blunderCp: number;
}
export const defaultOptions: LoopOptions = {
  mode: "jev_minimax",
  depth: 2,
  seed: 7,
  refereeDepth: 2,
  blunderCp: BLUNDER_CP,
};
export interface PendingAsk {
  summary: PositionSummary;
  candidates: MoveCandidate[];
  fen: string;
}
/**
 * What Jev needs to be asked about the current position, or null when the side
 * to move is not Jev, the game is over, or there is only one legal move (which
 * a Choice question cannot express, and which needs no decision anyway).
 */
export function pendingAsk(game: Chess): PendingAsk | null {
  if (game.isGameOver() || game.turn() !== JEV_COLOR) return null;
  const candidates = legalMoves(game);
  if (candidates.length < 2) return null;
  return {
    summary: buildPositionSummary(game, candidates),
    candidates,
    fen: game.fen(),
  };
}
export interface PlyInput {
  san: string;
  source: MoveSource;
  summary?: PositionSummary;
  candidates?: MoveCandidate[];
  probabilities?: Record<string, number>;
  confidence?: number | null;
  latencyMs?: number;
  error?: string;
}
/**
 * Plays one ply and records it. Jev plies are judged by the referee; the
 * opponent's are not, because the page only ever claims to measure Jev.
 */
export function playPly(
  game: Chess,
  ply: PlyInput,
  options: LoopOptions,
): { game: Chess; record: MoveRecord } {
  const fenBefore = game.fen();
  const color = game.turn();
  const judged =
    color === JEV_COLOR ? judgeMove(game, ply.san, options.refereeDepth) : null;
  const next = applyMove(game, ply.san);
  return {
    game: next,
    record: {
      ply: next.history().length,
      color,
      san: ply.san,
      source: ply.source,
      ...(ply.summary ? { summary: ply.summary } : {}),
      ...(ply.candidates ? { candidates: ply.candidates } : {}),
      ...(ply.probabilities ? { probabilities: ply.probabilities } : {}),
      ...(typeof ply.confidence === "number"
        ? { confidence: ply.confidence }
        : {}),
      ...(typeof ply.latencyMs === "number"
        ? { latencyMs: ply.latencyMs }
        : {}),
      ...(ply.error ? { error: ply.error } : {}),
      lossCp: judged ? judged.lossCp : null,
      // Walking into mate is always a blunder, whatever the threshold says.
      blunder: !!judged && (judged.mate || judged.lossCp >= options.blunderCp),
      mate: !!judged && judged.mate,
      walkedIntoMate: !!judged && judged.walkedIntoMate,
      missedMate: !!judged && judged.missedMate,
      ...(judged ? { bestSan: judged.bestSan } : {}),
      fenBefore,
      fenAfter: next.fen(),
    },
  };
}
/**
 * The opponent's reply. Returns null in human mode, where the move comes from
 * the board instead, and when the game is already over.
 */
export function opponentMove(
  game: Chess,
  options: LoopOptions,
  random: () => number,
): { san: string; source: MoveSource } | null {
  if (game.isGameOver() || game.turn() === JEV_COLOR) return null;
  if (options.mode === "jev_human") return null;
  const san =
    options.mode === "jev_random"
      ? randomMove(game, random)
      : minimaxMove(game, options.depth, random);
  return san
    ? { san, source: options.mode === "jev_random" ? "random" : "minimax" }
    : null;
}
const mean = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
/**
 * End-of-game totals for Jev's side. `blunders` counts judged Jev plies that
 * gave away at least the threshold; `illegalAttempts` counts the plies where
 * Jev named something outside the legal list and the argmax had to stand in.
 */
export function summarize(
  sans: string[],
  moves: MoveRecord[],
  options: LoopOptions,
  moveLimitHit: boolean,
): GameSummary {
  const game = replay(sans);
  const ending = endingOf(game, JEV_COLOR);
  const jevMoves = moves.filter((move) => move.color === JEV_COLOR);
  const judged = jevMoves.filter((move) => move.lossCp !== null);
  // Mate scores are excluded from the centipawn figures and counted on their
  // own; averaging a 100000 mate score with real material produces nonsense.
  const losses = judged
    .filter((move) => !move.mate)
    .map((move) => move.lossCp as number);
  const confidences = jevMoves
    .map((move) => move.confidence)
    .filter((value): value is number => typeof value === "number");
  const latencies = jevMoves
    .map((move) => move.latencyMs)
    .filter((value): value is number => typeof value === "number" && value > 0);
  return {
    outcome: ending.over
      ? ending.outcome
      : moveLimitHit
        ? "move_limit"
        : "in_progress",
    reason: ending.over ? ending.reason : moveLimitHit ? "move_limit" : "none",
    plies: moves.length,
    jevMoves: jevMoves.length,
    blunders: judged.filter((move) => move.blunder).length,
    blunderRate: judged.length
      ? judged.filter((move) => move.blunder).length / judged.length
      : 0,
    meanLossCp: mean(losses),
    worstLossCp: losses.length ? Math.max(...losses) : 0,
    matesAllowed: judged.filter((move) => move.walkedIntoMate).length,
    matesMissed: judged.filter((move) => move.missedMate).length,
    meanConfidence: confidences.length ? mean(confidences) : null,
    meanLatencyMs: mean(latencies),
    illegalAttempts: jevMoves.filter((move) => move.source === "jev_argmax")
      .length,
    failures: jevMoves.filter((move) => !!move.error).length,
    finalMaterial: materialBalance(game, JEV_COLOR),
  };
}
