import type { RankingRun } from "../types/rerank";
export function compareRankings(jev: RankingRun, baseline: RankingRun) {
  const jids = new Set(jev.candidates.map((c) => c.id));
  const valid =
    jev.candidates.length >= 2 &&
    jev.candidates.every((c) => c.score !== null) &&
    jids.size === jev.candidates.length &&
    baseline.candidates.length === jids.size &&
    baseline.candidates.every((c) => jids.has(c.id) && c.score !== null) &&
    new Set(baseline.candidates.map((c) => c.id)).size === jids.size;
  if (!valid) return null;
  const n = jev.candidates.length,
    k = Math.min(10, n);
  const br = new Map(baseline.candidates.map((c, i) => [c.id, i + 1]));
  const top = new Set(baseline.candidates.slice(0, k).map((c) => c.id));
  const deltas = jev.candidates.map((c, i) => ({
    id: c.id,
    jevRank: i + 1,
    baselineRank: br.get(c.id)!,
    delta: Math.abs(i + 1 - br.get(c.id)!),
  }));
  return {
    k,
    overlap: jev.candidates.slice(0, k).filter((c) => top.has(c.id)).length / k,
    correlation:
      1 -
      (6 * deltas.reduce((sum, c) => sum + c.delta * c.delta, 0)) /
        (n * (n * n - 1)),
    disagreements: deltas.filter(
      (c) => c.delta >= Math.max(5, Math.ceil(n * 0.2)),
    ),
    deltas,
  };
}
