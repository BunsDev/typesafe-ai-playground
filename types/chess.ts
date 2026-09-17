/**
 * "Jev Attempts Chess": a deliberate limitations demo.
 *
 * Chess needs lookahead. Jev is a System One decision model — one fast
 * classification, no search, no memory between calls. This workspace wires it
 * up honestly anyway: a real rules engine generates the legal moves, Jev picks
 * one from that closed list, and the board shows what happens.
 *
 * Every value Jev sees about a position is defined in this file. Nothing about
 * the geometry of the board is sent, because Jev is never asked to reason about
 * it — legality is the rules engine's job, and stays there.
 */

/** Who plays which side. Jev is always White; the opponent is always Black. */
export type GameMode = "jev_random" | "jev_minimax" | "jev_human";
export const gameModes: GameMode[] = ["jev_random", "jev_minimax", "jev_human"];
export const modeLabels: Record<GameMode, string> = {
  jev_random: "Jev vs Random",
  jev_minimax: "Jev vs Minimax",
  jev_human: "Jev vs Human",
};
export const modeBlurbs: Record<GameMode, string> = {
  jev_random:
    "Black plays a seeded uniform-random legal move. The weakest possible opponent, and the fairest floor: anything Jev does above this line is real signal.",
  jev_minimax:
    "Black runs the depth-limited minimax below. A few hundred lines of material counting, and the thing Jev is here to lose to.",
  jev_human:
    "You play Black by clicking a piece and then its destination. Jev answers every move you make.",
};
/** Centipawn value per piece type, used by the evaluator and the referee. */
export const pieceValues: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};
export const pieceNames: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};
/** Unicode glyphs for the board. Index by colour then type. */
export const pieceGlyphs: Record<"w" | "b", Record<string, string>> = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};
/**
 * The compact, structured position Jev receives. Deliberately not the board:
 * no squares, no piece placement, no move history. A summary this thin is the
 * point of the demo — it is roughly what a single classification can act on,
 * and it is nowhere near enough to play chess with.
 */
export interface PositionSummary {
  side_to_move: "white" | "black";
  move_number: number;
  material_balance: number;
  in_check: boolean;
  legal_move_count: number;
  captures_available: number;
  checks_available: number;
  phase: GamePhase;
  last_opponent_move: string;
}
export type GamePhase = "opening" | "middlegame" | "endgame";
export type SummaryField = keyof PositionSummary;
export const summaryFields: SummaryField[] = [
  "side_to_move",
  "move_number",
  "material_balance",
  "in_check",
  "legal_move_count",
  "captures_available",
  "checks_available",
  "phase",
  "last_opponent_move",
];
/** What each summary field means, sent verbatim so a bad pick is traceable. */
export const fieldHints: Record<SummaryField, string> = {
  side_to_move: "which colour is to move now",
  move_number: "the full-move number, counting from 1",
  material_balance:
    "centipawns from the mover's point of view, positive when the mover is ahead",
  in_check: "whether the mover's king is currently attacked",
  legal_move_count: "how many legal moves the mover has",
  captures_available: "how many of those legal moves capture a piece",
  checks_available: "how many of those legal moves give check",
  phase: "opening, middlegame or endgame, by material remaining",
  last_opponent_move: "the opponent's previous move in algebraic notation",
};
/**
 * One legal move, as the rules engine describes it. `san` is the candidate key
 * in the Choice question, so Jev can only ever answer with a move that the
 * engine already proved legal.
 */
export interface MoveCandidate {
  san: string;
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: string;
  gives_check: boolean;
  gives_mate: boolean;
  /** Centipawns of material the move wins outright, before any reply. */
  material_gain: number;
}
/** Where a played move came from. */
export type MoveSource =
  "jev" | "jev_argmax" | "jev_fallback" | "random" | "minimax" | "human";
export const sourceLabels: Record<MoveSource, string> = {
  jev: "Jev chose this move",
  jev_argmax:
    "Jev named a move outside the legal list; its best-scoring legal candidate was played instead",
  jev_fallback:
    "Jev returned nothing usable; the engine played the first legal move so the game could continue",
  random: "Seeded random baseline",
  minimax: "Minimax baseline",
  human: "You played this move",
};
/** A single ply, with everything needed to audit it after the fact. */
export interface MoveRecord {
  ply: number;
  color: "w" | "b";
  san: string;
  source: MoveSource;
  /** Present only for Jev plies. */
  summary?: PositionSummary;
  candidates?: MoveCandidate[];
  probabilities?: Record<string, number>;
  confidence?: number;
  latencyMs?: number;
  error?: string;
  /**
   * Centipawns given away versus the best move available, as scored by the
   * minimax referee. Null when the position was not scored, and meaningless
   * when `mate` is true — a mate score is not a material count.
   */
  lossCp: number | null;
  blunder: boolean;
  /** The referee scored this move as allowing or throwing away a forced mate. */
  mate: boolean;
  walkedIntoMate: boolean;
  missedMate: boolean;
  bestSan?: string;
  fenBefore: string;
  fenAfter: string;
}
export type GameOutcome =
  "in_progress" | "jev_win" | "opponent_win" | "draw" | "move_limit";
export const outcomeLabels: Record<GameOutcome, string> = {
  in_progress: "In progress",
  jev_win: "Jev won",
  opponent_win: "Jev lost",
  draw: "Draw",
  move_limit: "Move limit reached",
};
/** Why the game ended, in the rules engine's own terms. */
export type EndReason =
  | "checkmate"
  | "stalemate"
  | "insufficient_material"
  | "threefold_repetition"
  | "fifty_move_rule"
  | "move_limit"
  | "none";
export const reasonLabels: Record<EndReason, string> = {
  checkmate: "checkmate",
  stalemate: "stalemate",
  insufficient_material: "insufficient material",
  threefold_repetition: "threefold repetition",
  fifty_move_rule: "the fifty-move rule",
  move_limit: "the move limit",
  none: "—",
};
export interface GameState {
  fen: string;
  moves: MoveRecord[];
  outcome: GameOutcome;
  reason: EndReason;
  mode: GameMode;
  seed: number;
}
/** End-of-game totals for Jev's side only. The opponent is the control. */
export interface GameSummary {
  outcome: GameOutcome;
  reason: EndReason;
  plies: number;
  jevMoves: number;
  blunders: number;
  blunderRate: number;
  /** Averaged over judged moves that are not mate scores. */
  meanLossCp: number;
  worstLossCp: number;
  /** Judged moves scored as mate, counted apart from the centipawn figures. */
  matesAllowed: number;
  matesMissed: number;
  meanConfidence: number | null;
  meanLatencyMs: number;
  illegalAttempts: number;
  failures: number;
  finalMaterial: number;
}
export const isCandidate = (
  san: unknown,
  candidates: MoveCandidate[],
): san is string =>
  typeof san === "string" && candidates.some((c) => c.san === san);
