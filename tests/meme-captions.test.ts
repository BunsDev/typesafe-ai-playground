import { test } from "node:test";
import assert from "node:assert/strict";
import {
  captionScore,
  splitCaptions,
  type CaptionLine,
} from "../lib/meme-captions";
const line = (text: string, y: number, confidence = 95): CaptionLine => ({
  text,
  confidence,
  bbox: { x0: 20, x1: 250, y0: y, y1: y + 30 },
});
test("preserves identical captions in separate panels and orders their lines", () => {
  const result = splitCaptions(
    [
      line("fewer AI generated images", 580),
      line("You start seeing", 100),
      line("fewer AI generated images", 140),
      line("You start seeing", 540),
    ],
    800,
  );
  assert.equal(result.setup, "You start seeing fewer AI generated images");
  assert.equal(result.punchline, result.setup);
  assert.equal(
    result.text,
    "You start seeing\nfewer AI generated images\n\nYou start seeing\nfewer AI generated images",
  );
});
test("does not invent a punchline by splitting a wrapped single caption", () => {
  assert.deepEqual(
    splitCaptions([line("One caption", 100), line("on two lines", 140)], 800),
    {
      text: "One caption\non two lines",
      setup: "One caption on two lines",
      punchline: "",
    },
  );
});
test("punctuation and low-confidence background fragments do not count as captions", () => {
  const noise = [line("--", 10), line("=", 60), line("JR", 100, 43)];
  assert.deepEqual(splitCaptions(noise, 800), {
    text: "",
    setup: "",
    punchline: "",
  });
  assert.equal(captionScore(noise), 0);
  assert.ok(captionScore([line("Real caption", 20)]) > captionScore(noise));
});
test("empty results stay empty, and an actual one-word caption is retained", () => {
  assert.equal(splitCaptions([], 800).text, "");
  assert.equal(splitCaptions([line("NOPE", 10)], 800).setup, "NOPE");
});
