/** Public input price checked 2026-09-16: https://typesafe.ai/ ($42 / billion).
 * This is a list-price estimate, never an account bill or a promise of plan pricing. */
export const INPUT_USD_PER_MILLION = 0.042;
export function estimateCost(tokens: number): number {
  return (Math.max(0, tokens) * INPUT_USD_PER_MILLION) / 1_000_000;
}
export function estimateInputTokens(payload: unknown): number {
  return Math.ceil(JSON.stringify(payload ?? {}).length / 4);
}
export function reportedTokens(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}
