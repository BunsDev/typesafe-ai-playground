import { reportedTokens } from "./estimateCost";
import { fetchPublicDocument } from "./publicDocument";
const finite = (v: unknown): number | null => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
export type ResearchMetrics = {
  toolCalls: number; documentCalls: number; modelCalls: number;
  tokensIn: number | null; tokensOut: number | null;
  contextCharacters: number; contextEstimatedTokens: number;
  wallclockMs: number; totalCostUsd: number | null;
  costSource: "reported" | "estimated" | "no-model-calls" | "unknown";
  costPerCreditUsd: number | null; creditsUsed: number | null;
};
export type ResearchPricing = { inputUsdPerMillion?: number; outputUsdPerMillion?: number; usdPerCredit?: number };
export function researchPricing(): ResearchPricing {
  const read = (name: string) => {
    const raw = process.env[name]?.trim();
    return raw && finite(Number(raw)) !== null ? Number(raw) : undefined;
  };
  return { inputUsdPerMillion: read("TEXT_MODEL_INPUT_USD_PER_MILLION"), outputUsdPerMillion: read("TEXT_MODEL_OUTPUT_USD_PER_MILLION"), usdPerCredit: read("RESEARCH_USD_PER_CREDIT") };
}
/** Logical tool attempts, including failures. HTTP redirect hops are not additional tools. */
export class ResearchMeter {
  private started = performance.now();
  documentCalls = 0;
  modelCalls = 0;
  contextCharacters = 0;
  usage: Record<string, unknown> | null = null;
  read = async (url: string, signal: AbortSignal) => {
    this.documentCalls++;
    return fetchPublicDocument(url, signal);
  };
  finish(pricing: ResearchPricing = {}): ResearchMetrics {
    const tokensIn = this.modelCalls ? reportedTokens(this.usage?.prompt_tokens ?? this.usage?.input_tokens) : 0;
    const tokensOut = this.modelCalls ? reportedTokens(this.usage?.completion_tokens ?? this.usage?.output_tokens) : 0;
    let totalCostUsd = this.modelCalls ? finite(this.usage?.cost) : 0;
    let costSource: ResearchMetrics["costSource"] = !this.modelCalls ? "no-model-calls" : totalCostUsd !== null ? "reported" : "unknown";
    if (totalCostUsd === null && tokensIn !== null && tokensOut !== null && finite(pricing.inputUsdPerMillion) !== null && finite(pricing.outputUsdPerMillion) !== null) {
      totalCostUsd = (tokensIn * pricing.inputUsdPerMillion! + tokensOut * pricing.outputUsdPerMillion!) / 1_000_000;
      costSource = "estimated";
    }
    const creditPrice = finite(pricing.usdPerCredit);
    const costPerCreditUsd = creditPrice && creditPrice > 0 ? creditPrice : null;
    return {
      toolCalls: this.documentCalls + this.modelCalls, documentCalls: this.documentCalls, modelCalls: this.modelCalls,
      tokensIn, tokensOut, contextCharacters: this.contextCharacters, contextEstimatedTokens: Math.ceil(this.contextCharacters / 4),
      wallclockMs: Math.round(performance.now() - this.started), totalCostUsd, costSource, costPerCreditUsd,
      creditsUsed: costPerCreditUsd !== null && totalCostUsd !== null ? totalCostUsd / costPerCreditUsd : null,
    };
  }
}
