import { FLIGHT_GOAL } from "./flightSandbox";

export const PC_BUILD_GOAL = "Go to newegg.com and pick out parts to build a PC for $2,500. Make good use of the budget for 1440p gaming.";
const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!]+$/, "");

/** Match supported task contexts before choosing an executor or verifier. */
export function resolveBrowserContext(goal: string) {
  if (normalize(goal) === normalize(FLIGHT_GOAL))
    return { kind: "flight", verifier: "verifyFlightSearch" } as const;
  if (/\bnewegg(?:\.com)?\b/i.test(goal)) {
    const budgets = [...goal.matchAll(/(?:US\s*)?\$\s*([\d,]+(?:\.\d{1,2})?)/gi)].map((m) => Math.round(Number(m[1].replaceAll(",", "")) * 100));
    if (budgets.length === 1 && budgets[0] === 250000 && /\b1440p\b/i.test(goal) && /\b(?:pc|computer)\b/i.test(goal) && !/\b(?:1080p|2160p|4k|8k|CAD|AUD)\b/i.test(goal))
      return { kind: "newegg", budgetCents: 250000, currency: "USD", resolution: "1440p", store: "https://www.newegg.com", scope: "tower-only, before tax and shipping", verifier: "validateBuild + verifySelectedParts" } as const;
    return { kind: "unsupported", reason: "The Newegg workflow currently supports a $2,500 USD tower for 1440p gaming. Choose that preset or revise the goal; other budgets and targets require a matching workflow." } as const;
  }
  return { kind: "unsupported", reason: "This goal has no matching executor and verifier. Choose the flight sandbox or Newegg PC preset. Arbitrary websites cannot run inside the flight sandbox." } as const;
}
