import { validateRerankRequest } from "./rerank-data";
import type { RerankRequest, RankingRun } from "../types/rerank";
export function rerankWithBaseline(input: RerankRequest): RankingRun {
  validateRerankRequest(input);
  const start = performance.now();
  const words = [
    ...new Set(input.query.toLowerCase().match(/[a-z0-9_]+/g) ?? []),
  ].filter(
    (w) =>
      !["where", "is", "the", "a", "an", "how", "what", "handled"].includes(w),
  );
  const candidates = input.candidates
    .map((c) => {
      const tokens = new Set(c.text.toLowerCase().match(/[a-z0-9_]+/g) ?? []);
      const score = words.length
        ? words.filter((w) => tokens.has(w)).length / words.length
        : 0;
      return { ...c, score, confidence: null };
    })
    .sort((a, b) => b.score - a.score || b.vectorScore - a.vectorScore);
  return {
    method: "baseline",
    candidates,
    latencyMs: performance.now() - start,
    requests: 0,
  };
}
