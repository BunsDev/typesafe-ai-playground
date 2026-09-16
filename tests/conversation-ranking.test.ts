import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rankConversationRows,
  candidateMessage,
} from "../lib/conversation-ranking";
import { buildCandidates, type Row } from "../web/conversation";
test("ranking preserves score ties and keeps unavailable candidates unranked", () => {
  const row = (speaker: string, noul: number): Row => ({
    variant: "candidate",
    speaker,
    response: { answers: { should_respond: { type: "noul", noul } } },
  });
  const rows = [
    row("low", 0.2),
    row("top", 0.9),
    row("tie", 0.9),
    row("bad", NaN),
  ];
  const ranked = rankConversationRows(rows);
  assert.deepEqual(
    ranked.map((r) => [r.row.speaker, r.rank]),
    [
      ["top", 1],
      ["tie", 1],
      ["low", 3],
      ["bad", null],
    ],
  );
  assert.equal(rows[0].speaker, "low");
});
test("message preview is the exact candidate target, not the last message of the whole transcript", () => {
  const candidates = buildCandidates({
    transcript: "A: Earlier\nB: A separate question?\nA: Latest from A",
    format: "labeled",
    policy: "Answer questions",
    model: "jev-latest",
  });
  assert.deepEqual(
    candidates.map(candidateMessage).map((m) => [m?.speaker, m?.content]),
    [
      ["B", "A separate question?"],
      ["A", "Latest from A"],
    ],
  );
});
