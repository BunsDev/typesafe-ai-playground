import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMove,
  describeCandidate,
  endingOf,
  gameFrom,
  legalMoves,
  materialBalance,
  phaseOf,
  replay,
  rng,
} from "../lib/chessEngine";
import { buildPositionSummary } from "../lib/buildPositionSummary";
import {
  isMateScore,
  judgeMove,
  minimaxMove,
  randomMove,
  scoreMoves,
} from "../lib/baselineMinimax";
import {
  buildMovePayload,
  resolveMove,
  topMove,
} from "../lib/classifyMoveWithJev";
import {
  defaultOptions,
  opponentMove,
  pendingAsk,
  playPly,
  summarize,
} from "../lib/chessGameLoop";
import { summaryFields, type MoveCandidate } from "../types/chess";

/** Scholar's mate, one ply short: White to play Qxf7#. */
const MATE_IN_ONE = ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"];
/**
 * Material is level and the black queen sits undefended on d5, where the c4
 * pawn takes it. Depth 2 sees the capture; a single classification has no way
 * to, because nothing in the position summary says a queen is hanging.
 */
const HANGING_QUEEN =
  "rnb1kbnr/pppppppp/8/3q4/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 0 1";

test("legal moves come from the rules engine and carry only stated facts", () => {
  const game = replay([]);
  const moves = legalMoves(game);
  assert.equal(moves.length, 20);
  assert.ok(moves.every((move) => move.san && move.from && move.to));
  assert.ok(moves.every((move) => move.material_gain === 0));
  assert.ok(moves.every((move) => !move.gives_check && !move.gives_mate));
  // Every SAN the engine reports is playable, which is what makes the closed
  // set safe: Jev cannot name an illegal move because it never sees one.
  for (const move of moves)
    assert.doesNotThrow(() => applyMove(game, move.san));
});

test("a mating move is flagged as mate, not merely check", () => {
  const moves = legalMoves(replay(MATE_IN_ONE));
  const mate = moves.find((move) => move.san === "Qxf7#");
  assert.ok(mate, "Qxf7# should be legal here");
  assert.equal(mate.gives_mate, true);
  assert.equal(mate.gives_check, true);
  assert.equal(mate.material_gain, 100);
  assert.match(describeCandidate(mate), /checkmate/i);
});

test("replaying preserves history that a FEN rebuild would lose", () => {
  const shuffle = ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"];
  const game = replay(shuffle);
  assert.equal(game.history().length, 8);
  assert.equal(game.isThreefoldRepetition(), true);
  assert.equal(endingOf(game, "w").reason, "threefold_repetition");
  // The summary's last_opponent_move depends on that history being intact.
  assert.equal(buildPositionSummary(game).last_opponent_move, "Ng8");
});

test("the position summary sends nine fields and no board", () => {
  const game = replay(["e4", "e5"]);
  const summary = buildPositionSummary(game);
  assert.deepEqual(Object.keys(summary).sort(), [...summaryFields].sort());
  assert.equal(summary.side_to_move, "white");
  assert.equal(summary.move_number, 2);
  assert.equal(summary.material_balance, 0);
  assert.equal(summary.in_check, false);
  assert.equal(summary.last_opponent_move, "e5");
  assert.equal(summary.phase, "opening");
  const serialized = JSON.stringify(summary);
  // No square name and no FEN may reach the payload.
  assert.doesNotMatch(serialized, /rnbq|\/8\/|[a-h][1-8][a-h][1-8]/);
});

test("phase follows material, not move number", () => {
  assert.equal(phaseOf(replay([])), "opening");
  assert.equal(phaseOf(replay(["e4", "e5"])), "opening");
  // Kings and a lone pawn each: an endgame however few moves have been played.
  assert.equal(
    phaseOf(gameFrom("4k3/4p3/8/8/8/8/4P3/4K3 w - - 0 1")),
    "endgame",
  );
});

test("the payload asks one closed question keyed by legal SAN", () => {
  const game = replay([]);
  const candidates = legalMoves(game);
  const summary = buildPositionSummary(game, candidates);
  const { payload } = buildMovePayload(summary, candidates, "jev-latest");
  assert.deepEqual(Object.keys(payload.questions), ["move"]);
  assert.equal(payload.questions.move.type, "choice");
  const criteria = payload.questions.move.criteria as Record<string, string>;
  assert.deepEqual(
    Object.keys(criteria).sort(),
    candidates.map((move) => move.san).sort(),
  );
  assert.equal(payload.state, summary);
  assert.ok(Object.values(criteria).every((line) => line.length > 10));
});

test("a position with fewer than two legal moves is never asked about", () => {
  const candidates = legalMoves(replay([]));
  assert.throws(
    () =>
      buildMovePayload(
        buildPositionSummary(replay([])),
        candidates.slice(0, 1),
        "m",
      ),
    /at least two legal moves/,
  );
  // Checkmate leaves nothing to decide, so no request is built at all.
  assert.equal(pendingAsk(replay([...MATE_IN_ONE, "Qxf7#"])), null);
});

test("a named legal move is played as chosen", () => {
  const candidates = legalMoves(replay([]));
  const choice = resolveMove(
    {
      answers: {
        move: {
          type: "choice",
          choice: "e4",
          probabilities: { e4: 0.6, d4: 0.2 },
        },
      },
    } as never,
    candidates,
  );
  assert.equal(choice.san, "e4");
  assert.equal(choice.source, "jev");
  assert.equal(choice.outOfSet, false);
  assert.equal(choice.confidence, 0.6);
});

test("a move outside the legal list falls back to the best scoring legal one", () => {
  const candidates = legalMoves(replay([]));
  const choice = resolveMove(
    {
      answers: {
        move: {
          type: "choice",
          choice: "Qxh7#",
          probabilities: { e4: 0.3, d4: 0.9, Qxh7: 0.99 },
        },
      },
    } as never,
    candidates,
  );
  assert.equal(choice.san, "d4");
  assert.equal(choice.source, "jev_argmax");
  assert.equal(choice.outOfSet, true);
  // The illegal move is stripped from the distribution rather than ranked.
  assert.deepEqual(Object.keys(choice.probabilities).sort(), ["d4", "e4"]);
});

test("nothing usable still produces a legal move rather than a hang", () => {
  const candidates = legalMoves(replay([]));
  const dead = resolveMove(undefined, candidates);
  assert.equal(dead.source, "jev_fallback");
  assert.equal(dead.san, candidates[0].san);
  assert.equal(dead.confidence, null);
  const empty = resolveMove({ answers: {} } as never, candidates);
  assert.equal(empty.source, "jev_fallback");
  assert.equal(topMove({}), null);
});

test("minimax takes a free queen that the position summary cannot describe", () => {
  const game = gameFrom(HANGING_QUEEN);
  assert.equal(minimaxMove(game, 2), "cxd5");
  const scored = scoreMoves(game, 2);
  const capture = scored.find((move) => move.san === "cxd5");
  const quiet = scored.find((move) => move.san === "a3");
  assert.ok(capture && quiet);
  assert.ok(
    capture.score > quiet.score,
    "winning a queen must outscore a quiet pawn move",
  );
  // The summary Jev would receive says only that one capture exists — not that
  // it wins a queen, and not that the queen is undefended.
  const summary = buildPositionSummary(game);
  assert.equal(summary.captures_available, 1);
  assert.equal(summary.material_balance, 0);
});

test("minimax takes mate when it is available", () => {
  assert.equal(minimaxMove(replay(MATE_IN_ONE), 2), "Qxf7#");
});

test("the referee separates mate scores from centipawn losses", () => {
  const game = replay(MATE_IN_ONE);
  const missed = judgeMove(game, "a3", 2);
  assert.ok(missed);
  assert.equal(missed.missedMate, true);
  assert.equal(missed.mate, true);
  assert.ok(isMateScore(missed.bestScore));
  assert.equal(missed.bestSan, "Qxf7#");
  const taken = judgeMove(game, "Qxf7#", 2);
  assert.ok(taken);
  assert.equal(taken.lossCp, 0);
  assert.equal(taken.mate, false);
});

test("the referee prices a hung queen in centipawns", () => {
  const judged = judgeMove(gameFrom(HANGING_QUEEN), "a3", 2);
  assert.ok(judged);
  assert.equal(judged.bestSan, "cxd5");
  assert.equal(judged.mate, false);
  assert.ok(
    judged.lossCp >= 900,
    `expected at least a queen, got ${judged.lossCp}`,
  );
});

test("an unjudgeable move returns nothing rather than a wrong score", () => {
  assert.equal(judgeMove(replay([]), "Qxf7#", 1), null);
  assert.equal(judgeMove(replay([...MATE_IN_ONE, "Qxf7#"]), "e4", 1), null);
});

test("mate scores are never averaged into the material figures", () => {
  const options = { ...defaultOptions, refereeDepth: 2 };
  let game = replay(MATE_IN_ONE);
  const played = playPly(game, { san: "a3", source: "jev" }, options);
  assert.equal(played.record.mate, true);
  assert.equal(played.record.missedMate, true);
  // Walking past a mate is a blunder whatever the centipawn threshold says.
  assert.equal(played.record.blunder, true);
  const summary = summarize(
    [...MATE_IN_ONE, "a3"],
    [played.record],
    options,
    false,
  );
  assert.equal(summary.matesMissed, 1);
  assert.equal(summary.meanLossCp, 0, "a mate score must not leak into cp");
  assert.equal(summary.worstLossCp, 0);
});

test("the blunder threshold re-marks moves without new requests", () => {
  const game = gameFrom(HANGING_QUEEN);
  const strict = playPly(
    game,
    { san: "a3", source: "jev" },
    {
      ...defaultOptions,
      blunderCp: 200,
    },
  );
  const loose = playPly(
    game,
    { san: "a3", source: "jev" },
    {
      ...defaultOptions,
      blunderCp: 2000,
    },
  );
  assert.equal(strict.record.blunder, true);
  assert.equal(loose.record.blunder, false);
  assert.equal(strict.record.lossCp, loose.record.lossCp);
});

test("only Jev's moves are judged; the opponent's are left alone", () => {
  const options = defaultOptions;
  const black = playPly(
    replay(["e4"]),
    { san: "e5", source: "minimax" },
    options,
  );
  assert.equal(black.record.color, "b");
  assert.equal(black.record.lossCp, null);
  assert.equal(black.record.blunder, false);
});

test("a seeded game replays identically and the baselines stay closed", () => {
  const options = { ...defaultOptions, mode: "jev_random" as const, seed: 5 };
  const run = () => {
    const random = rng(options.seed);
    return Array.from({ length: 6 }, () => {
      const reply = opponentMove(replay(["e4"]), options, random);
      return reply?.san;
    });
  };
  assert.deepEqual(run(), run());
  const legal = new Set(replay(["e4"]).moves());
  assert.ok(run().every((san) => san && legal.has(san)));
  assert.equal(randomMove(replay([...MATE_IN_ONE, "Qxf7#"]), rng(1)), null);
});

test("the opponent stays silent in human mode and after the game ends", () => {
  const random = rng(3);
  assert.equal(
    opponentMove(
      replay(["e4"]),
      { ...defaultOptions, mode: "jev_human" },
      random,
    ),
    null,
  );
  // Jev's own turn is never played by the opponent.
  assert.equal(opponentMove(replay([]), defaultOptions, random), null);
  assert.equal(
    opponentMove(replay([...MATE_IN_ONE, "Qxf7#"]), defaultOptions, random),
    null,
  );
});

test("the summary reports the result from Jev's side", () => {
  const options = defaultOptions;
  const sans = [...MATE_IN_ONE, "Qxf7#"];
  const won = summarize(sans, [], options, false);
  assert.equal(won.outcome, "jev_win");
  assert.equal(won.reason, "checkmate");
  // Fool's mate: Black mates, so the same code must read it as a loss.
  const lost = summarize(["f3", "e5", "g4", "Qh4#"], [], options, false);
  assert.equal(lost.outcome, "opponent_win");
  assert.equal(lost.reason, "checkmate");
  const capped = summarize(["e4", "e5"], [], options, true);
  assert.equal(capped.outcome, "move_limit");
  assert.equal(capped.reason, "move_limit");
});

test("summary totals count illegal picks, failures and material", () => {
  const options = defaultOptions;
  const candidates: MoveCandidate[] = legalMoves(replay([]));
  const records = [
    playPly(
      replay([]),
      {
        san: "e4",
        source: "jev_argmax",
        candidates,
        probabilities: { e4: 0.8 },
        confidence: 0.8,
        latencyMs: 120,
      },
      options,
    ).record,
    playPly(
      replay(["e4", "e5"]),
      {
        san: "Nf3",
        source: "jev",
        confidence: 0.4,
        latencyMs: 80,
        error: "Rate limit reached.",
      },
      options,
    ).record,
  ];
  const summary = summarize(["e4", "e5", "Nf3"], records, options, false);
  assert.equal(summary.jevMoves, 2);
  assert.equal(summary.illegalAttempts, 1);
  assert.equal(summary.failures, 1);
  assert.equal(summary.meanConfidence, 0.6000000000000001);
  assert.equal(summary.meanLatencyMs, 100);
  assert.equal(summary.finalMaterial, 0);
});

test("material balance is signed from the side asked about", () => {
  const game = applyMove(gameFrom(HANGING_QUEEN), "cxd5");
  assert.equal(materialBalance(game, "w"), 900);
  assert.equal(materialBalance(game, "b"), -900);
});

test("a game built from a FEN clones as itself, not as the opening", () => {
  const game = applyMove(gameFrom(HANGING_QUEEN), "a3");
  // Without the setup header this would silently reset to the standard start.
  assert.equal(game.history().length, 1);
  assert.match(game.fen(), /^rnb1kbnr\/pppppppp\/8\/3q4\/2P5\/P7\//);
});
