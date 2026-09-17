import { type Route } from "@playwright/test";
/**
 * A scripted stand-in for Jev. It reads the same indexed element table the
 * real model gets and answers the operation plus target heads in one reply.
 * The script may know the sandbox; the policy under test may not.
 */
type Row = { index: string; role: string; label: string; value: string };
const parse = (rows: string[]): Row[] =>
  rows.flatMap((row) => {
    const m = row.match(/^\[([\d:]+)\] (\S+)\s+(.*?) · (.*?)(?: · .*)?$/);
    return m ? [{ index: m[1], role: m[2], label: m[3], value: m[4] }] : [];
  });
const answer = (head: string, choice: string, confidence = 0.95) => ({
  [head]: {
    type: "choice",
    choice,
    confidence,
    probabilities: { [choice]: confidence },
  },
});
export function scriptedPolicy(payload: any, mode: "solve" | "always-done") {
  const rows = parse(payload.state.element_table);
  const text: string = payload.state.page.text;
  const recent: { outcome: string }[] = payload.state.recent_actions;
  const find = (role: string, label: string) =>
    rows.find((r) => r.role === role && r.label === label);
  const select = payload.questions.select_target?.criteria ?? {};
  const oneWay = Object.entries(select).find(([, v]) =>
    String(v).includes("One way"),
  )?.[0];
  const option = rows.find((r) => r.role === "option");
  const lastRejected = recent.at(-1)?.outcome.startsWith("rejected: Covered");
  const gotIt = find("button", "Got it");
  if (mode === "always-done") return { answers: answer("operation", "DONE") };
  const decide = (): Record<string, unknown> => {
    if (lastRejected && gotIt)
      return {
        ...answer("operation", "CLICK"),
        ...answer("click_target", gotIt.index),
      };
    if (option)
      return {
        ...answer("operation", "CLICK"),
        ...answer("click_target", option.index),
      };
    if (find("combobox", "Trip type")?.value === "Round trip" && oneWay)
      return {
        ...answer("operation", "SELECT"),
        ...answer("select_target", oneWay),
      };
    for (const label of ["Where from?", "Where to?", "Departure date"]) {
      const row = find(
        label === "Departure date" ? "textbox" : "combobox",
        label,
      );
      if (row && row.value === "empty")
        return {
          ...answer("operation", "TYPE_TEXT"),
          ...answer("type_text_target", row.index),
        };
    }
    if (text.includes("Searching flights")) return answer("operation", "WAIT");
    if (
      text.includes("Showing") ||
      rows.some((r) => r.label === "Select flight")
    )
      return answer("operation", "DONE");
    const search = find("button", "Search flights");
    if (search)
      return {
        ...answer("operation", "CLICK"),
        ...answer("click_target", search.index),
      };
    // The control is below the fold on narrow screens: scroll, as a real run would.
    if (payload.questions.operation.criteria.SCROLL_DOWN)
      return answer("operation", "SCROLL_DOWN");
    return answer("operation", "BLOCKED");
  };
  return { answers: decide() };
}
const values: Record<string, string> = {
  "Where from?": "Zurich",
  "Where to?": "London",
  "Departure date": "20 September 2026",
};
export async function mockModels(
  route: Route,
  mode: "solve" | "always-done",
  calls: any[],
) {
  const url = route.request().url();
  if (url.includes("/api/text-helper")) {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { configured: true, model: "mock-text" } });
    const context = route.request().postDataJSON().context;
    return route.fulfill({
      json: {
        content: JSON.stringify({ text: values[context.field.label] ?? null }),
        model: "mock-text",
      },
    });
  }
  const payload = route.request().postDataJSON();
  calls.push(payload);
  return route.fulfill({ json: scriptedPolicy(payload, mode) });
}
