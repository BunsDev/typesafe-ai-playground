export interface RerankCandidate {
  id: string;
  text: string;
  vectorScore: number;
}
export interface RerankRequest {
  query: string;
  candidates: RerankCandidate[];
}
export interface RankedCandidate extends RerankCandidate {
  score: number | null;
  confidence: number | null;
  level?: string;
  error?: string;
}
export interface RankingRun {
  method: "jev" | "baseline" | "vector";
  candidates: RankedCandidate[];
  latencyMs: number;
  requests: number;
}
