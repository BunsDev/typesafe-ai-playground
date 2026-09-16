export interface CaptionLine {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}
export interface MemeCaptions {
  text: string;
  setup: string;
  punchline: string;
}

/** Reject decoration and low-confidence background noise, without inventing words. */
export function readableLines(lines: CaptionLine[]): CaptionLine[] {
  return lines
    .map((line) => ({ ...line, text: line.text.trim() }))
    .filter(
      (line) => line.confidence >= 60 && /[a-z0-9]{2}|^[AI]$/i.test(line.text),
    )
    .sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
}

export function captionScore(lines: CaptionLine[]): number {
  return readableLines(lines).reduce(
    (score, line) =>
      score +
      (line.text.match(/[a-z0-9]+/gi)?.length || 0) *
        (line.confidence / 100) ** 3,
    0,
  );
}

/** A large vertical gap separates top/bottom captions; repeated captions are intentional. */
export function splitCaptions(
  lines: CaptionLine[],
  imageHeight: number,
): MemeCaptions {
  const readable = readableLines(lines);
  const heights = readable
    .map((line) => line.bbox.y1 - line.bbox.y0)
    .sort((a, b) => a - b);
  const typicalHeight = heights[Math.floor(heights.length / 2)] || 0;
  let split = -1;
  let largestGap = Math.max(imageHeight * 0.12, typicalHeight * 1.8);
  for (let i = 1; i < readable.length; i++) {
    const gap = readable[i].bbox.y0 - readable[i - 1].bbox.y1;
    if (gap > largestGap) {
      largestGap = gap;
      split = i;
    }
  }
  const setupLines = split < 0 ? readable : readable.slice(0, split);
  const punchlineLines = split < 0 ? [] : readable.slice(split);
  return {
    text: [setupLines, punchlineLines]
      .map((group) => group.map((line) => line.text).join("\n"))
      .filter(Boolean)
      .join("\n\n"),
    setup: setupLines.map((line) => line.text).join(" "),
    punchline: punchlineLines.map((line) => line.text).join(" "),
  };
}
