import type { AccountUsage } from "../types/usage";
/** No public quota resource in https://docs.typesafe.ai/api (checked 2026-09-16).
 * Do not guess a billing endpoint or send API keys to an undocumented resource.
 * Replace this adapter when TypeSafe publishes a supported account-usage API. */
export async function fetchAccountUsage(): Promise<AccountUsage> {
  return {
    available: false,
    plan: null,
    reason:
      "Account quota unavailable: TypeSafe does not document a public usage endpoint. Session usage only, not account-wide.",
  };
}
