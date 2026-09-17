import { test, expect } from "@playwright/test";
import { mockModels, scriptedPolicy } from "./browser-agent-policy";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { ok: true, configured: true } }),
  );
});
test("the loop searches the sandbox end to end and verifies the result independently", async ({
  page,
}) => {
  const calls: any[] = [];
  await page.route("**/api/run", (route) => mockModels(route, "solve", calls));
  await page.route("**/api/text-helper", (route) =>
    mockModels(route, "solve", calls),
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/jev-browser-agent");
  await expect(page.locator("h1")).toHaveText("Jev-powered browser agent");
  const frame = page.frameLocator("iframe.agent-sandbox");
  await expect(
    frame.getByRole("button", { name: "Search flights" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run agent" }).click();
  await expect(page.locator(".agent-workspace")).toHaveAttribute(
    "data-status",
    "done",
    { timeout: 20000 },
  );
  await expect(page.locator("#agent-verification .tag")).toHaveText("passed");
  await expect(page.locator(".agent-checks li[data-ok='false']")).toHaveCount(
    0,
  );
  // Every decision was one request carrying the operation and its target heads.
  for (const call of calls) {
    expect(call.questions.operation).toBeTruthy();
    expect(
      Object.keys(call.questions).every((k) =>
        /^(operation|click_target|type_text_target|select_target)$/.test(k),
      ),
    ).toBe(true);
  }
  // The covered Search button was rejected once, then dismissed via its popover.
  const log = page.locator(".router-step-log li");
  await expect(
    log.filter({ hasText: "Target rejected: Covered by dialog" }),
  ).toHaveCount(1);
  await expect(log.filter({ hasText: "Got it → Executed" })).toHaveCount(1);
  await expect(log.filter({ hasText: "Done · verified" })).toHaveCount(1);
  await expect(log.filter({ hasText: "typed “Zurich”" })).toHaveCount(1);
  await expect(frame.locator("[data-result]").first()).toBeVisible();
  await expect(frame.locator("[data-result][data-selected]")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("a DONE claim without visible results is rejected by the verifier, not trusted", async ({
  page,
}) => {
  const calls: any[] = [];
  await page.route("**/api/run", (route) =>
    mockModels(route, "always-done", calls),
  );
  await page.route("**/api/text-helper", (route) =>
    mockModels(route, "always-done", calls),
  );
  await page.goto("/jev-browser-agent");
  await expect(
    page
      .frameLocator("iframe.agent-sandbox")
      .getByRole("button", { name: "Search flights" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "One cycle" }).click();
  await expect(page.locator(".router-step-log li").first()).toContainText(
    "Done · rejected by verifier",
  );
  await expect(page.locator("#agent-verification .tag")).toHaveText(
    "not passed",
  );
  await expect(
    page.locator(".agent-checks li[data-ok='false']").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run agent" }).click();
  await expect(page.locator(".agent-workspace")).toHaveAttribute(
    "data-status",
    "failed",
    { timeout: 15000 },
  );
  await expect(page.locator(".agent-reason")).toContainText(
    "DONE was rejected 3 times",
  );
  expect(calls.length).toBe(3);
});
test("observe only reads the element table without a model call", async ({
  page,
}) => {
  let runCalls = 0;
  await page.route("**/api/run", (route) => {
    runCalls++;
    return route.fulfill({
      status: 500,
      json: { error: "should not be called" },
    });
  });
  await page.route("**/api/text-helper", (r) =>
    r.fulfill({ json: { configured: false, model: null } }),
  );
  await page.goto("/jev-browser-agent");
  await expect(
    page
      .frameLocator("iframe.agent-sandbox")
      .getByRole("button", { name: "Search flights" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Observe only" }).click();
  const table = page.getByLabel("Indexed element table");
  await expect(table).toContainText("combobox  Where from? · empty");
  await expect(table).toContainText("combobox  Trip type · Round trip");
  await expect(
    page.getByText("Jev picks a span of the goal (no TEXT_MODEL_API_KEY"),
  ).toBeVisible();
  expect(runCalls).toBe(0);
});

const blocked = {
  model: "jev-1.13.0",
  answers: {
    operation: {
      type: "choice",
      choice: "BLOCKED",
      confidence: 0.95,
      probabilities: {
        DONE: 0,
        TYPE_TEXT: 0.01,
        BLOCKED: 0.96,
        SELECT: 0,
        WAIT: 0,
        CLICK: 0.03,
      },
    },
    click_target: { type: "choice", choice: "13", confidence: 0.33 },
    type_text_target: { type: "choice", choice: "7", confidence: 0.85 },
    select_target: { type: "choice", choice: "4:1", confidence: 0.65 },
  },
};

test("a premature BLOCKED gets fresh feedback and can recover to a verified result", async ({
  page,
}) => {
  const calls: any[] = [];
  await page.route("**/api/text-helper", (route) =>
    mockModels(route, "solve", []),
  );
  await page.route("**/api/run", (route) => {
    const payload = route.request().postDataJSON();
    calls.push(payload);
    return route.fulfill({
      json: calls.length === 1 ? blocked : scriptedPolicy(payload, "solve"),
    });
  });
  await page.goto("/jev-browser-agent");
  await expect(
    page
      .frameLocator("iframe.agent-sandbox")
      .getByRole("button", { name: "Search flights" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "One cycle" }).click();
  await expect(page.locator(".agent-workspace")).toHaveAttribute(
    "data-status",
    "ready",
  );
  await expect(page.locator("#agent-verification .tag")).toHaveText(
    "not passed",
  );
  await page.getByRole("button", { name: "Run agent" }).click();
  await expect(page.locator(".agent-workspace")).toHaveAttribute(
    "data-status",
    "done",
    { timeout: 20000 },
  );
  expect(calls[1].state.recent_actions.at(-1)).toMatchObject({
    operation: "BLOCKED",
  });
  expect(calls[1].state.recent_actions.at(-1).outcome).toContain(
    "Choose again",
  );
  await expect(page.locator("#agent-verification .tag")).toHaveText("passed");
});

test("repeated BLOCKED stops after one retry without executing an action", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/text-helper", (route) =>
    mockModels(route, "solve", []),
  );
  await page.route("**/api/run", (route) => {
    calls++;
    return route.fulfill({ json: blocked });
  });
  await page.goto("/jev-browser-agent");
  await expect(
    page
      .frameLocator("iframe.agent-sandbox")
      .getByRole("button", { name: "Search flights" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run agent" }).click();
  await expect(page.locator(".agent-workspace")).toHaveAttribute(
    "data-status",
    "blocked",
  );
  expect(calls).toBe(2);
  await expect(
    page
      .locator(".agent-status div")
      .filter({ has: page.locator("dt", { hasText: /^Actions$/ }) })
      .locator("dd"),
  ).toHaveText("0");
  await expect(page.locator(".agent-reason")).toContainText(
    "after a fresh observation",
  );
});

test("a BLOCKED response for a changed page is discarded before counting retries", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/text-helper", (route) =>
    mockModels(route, "solve", []),
  );
  await page.route("**/api/run", async (route) => {
    calls++;
    if (calls === 1) {
      await page
        .frameLocator("iframe.agent-sandbox")
        .getByRole("combobox", { name: "Trip type" })
        .selectOption("one-way");
    }
    return route.fulfill({ json: blocked });
  });
  await page.goto("/jev-browser-agent");
  await expect(
    page
      .frameLocator("iframe.agent-sandbox")
      .getByRole("button", { name: "Search flights" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run agent" }).click();
  await expect(page.locator(".agent-workspace")).toHaveAttribute(
    "data-status",
    "blocked",
  );
  await expect(
    page.locator(".router-step-log li").filter({ hasText: "Stale decision" }),
  ).toHaveCount(1);
  expect(calls).toBe(3);
});

test("BLOCKED after completing the goal uses the independent verifier", async ({
  page,
}) => {
  await page.route("**/api/text-helper", (route) =>
    mockModels(route, "solve", []),
  );
  await page.route("**/api/run", (route) => {
    const response = scriptedPolicy(route.request().postDataJSON(), "solve");
    const operation = response.answers.operation as { choice: string };
    return route.fulfill({
      json: operation.choice === "DONE" ? blocked : response,
    });
  });
  await page.goto("/jev-browser-agent");
  await expect(
    page
      .frameLocator("iframe.agent-sandbox")
      .getByRole("button", { name: "Search flights" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run agent" }).click();
  await expect(page.locator(".agent-workspace")).toHaveAttribute(
    "data-status",
    "done",
    { timeout: 20000 },
  );
  await expect(page.locator("#agent-verification .tag")).toHaveText("passed");
  await expect(
    page
      .locator(".router-step-log li")
      .filter({ hasText: "BLOCKED → Done · verified" }),
  ).toHaveCount(1);
});

test("copy debug report includes both BLOCKED exchanges and measured evidence", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/api/text-helper", (route) => mockModels(route, "solve", []));
  await page.route("**/api/run", (route) => route.fulfill({ json: { ...blocked, _playgroundUsage: { inputTokens: 2586, outputTokens: 270, attempted: true, status: 200 } } }));
  await page.goto("/jev-browser-agent");
  const copy = page.getByRole("button", { name: "Copy debug report" });
  await expect(copy).toBeDisabled();
  await expect(page.frameLocator("iframe.agent-sandbox").getByRole("button", { name: "Search flights" })).toBeVisible();
  await page.getByRole("button", { name: "Run agent" }).click();
  await expect(page.locator(".agent-workspace")).toHaveAttribute("data-status", "blocked");
  await copy.click();
  await expect(page.getByRole("status").filter({ hasText: "Debug report copied" })).toBeVisible();
  const report = await page.evaluate(() => navigator.clipboard.readText());
  const data = JSON.parse(report.split("```json\n")[1].split("\n```")[0]);
  expect(data.run.log).toHaveLength(2);
  expect(data.run.log[0].request.state.element_table.length).toBeGreaterThan(0);
  expect(data.run.log[0].response.answers).toEqual(blocked.answers);
  expect(data.analytics.reportedModels).toEqual(["jev-1.13.0"]);
  expect(data.analytics.tokens.input.total).toBe(5172);
  expect(data.analytics.choices[0].margin).toBeCloseTo(0.93);
  expect(data.context.verifier.name).toBe("verifyFlightSearch");
  await expect(page.getByLabel("Debug report text")).toHaveValue(report);
});

test("clipboard denial leaves the full report selectable for manual copying", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw Error("Permission denied"); } }, configurable: true }));
  await page.route("**/api/text-helper", (route) => mockModels(route, "solve", []));
  await page.route("**/api/run", (route) => route.fulfill({ status: 502, json: { error: "Provider unavailable" } }));
  await page.goto("/jev-browser-agent");
  await expect(page.frameLocator("iframe.agent-sandbox").getByRole("button", { name: "Search flights" })).toBeVisible();
  await page.getByRole("button", { name: "Run agent" }).click();
  await expect(page.locator(".agent-workspace")).toHaveAttribute("data-status", "failed");
  await page.getByRole("button", { name: "Copy debug report" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Select and copy" })).toBeVisible();
  const report = page.getByLabel("Debug report text");
  const data = JSON.parse((await report.inputValue()).split("```json\n")[1].split("\n```")[0]);
  expect(data.run.log[0].request.model).toBe("jev-latest");
  expect(data.run.log[0].response).toBeNull();
  expect(data.run.log[0].detail).toContain("Provider unavailable");
  expect(data.analytics.tokens.input.total).toBeNull();
  await expect(report).toBeFocused();
});

test("a Newegg goal runs PC research with PC diagnostics and no flight calls", async ({ page }) => {
  let jevCalls = 0;
  let pcGoal = "";
  await page.route("**/api/text-helper", (route) => mockModels(route, "solve", []));
  await page.route("**/api/run", (route) => { jevCalls++; return route.fulfill({ json: blocked }); });
  await page.route("**/api/pc-build", (route) => {
    pcGoal = route.request().postDataJSON().goal;
    return route.fulfill({ json: { build: null, candidates: [], gaps: ["gpu: listing unavailable"], retrievedAt: "2026-09-17T12:00:00Z", elapsedMs: 50, error: "No verified GPU listings.", diagnostics: { context: { workflow: "newegg", goal: pcGoal, budgetCents: 250000, resolution: "1440p", verifier: "validateBuild + verifySelectedParts" }, documentReads: [] } } });
  });
  await page.goto("/jev-browser-agent");
  const goal = "go to newegg.com and pick out parts to build a pc for $2500 make good use of the budget. for 1440p gaming";
  await page.getByLabel("Goal", { exact: true }).fill(goal);
  await expect(page.getByText("Execution context: Newegg PC research", { exact: true })).toBeVisible();
  await expect(page.locator("iframe.agent-sandbox")).toHaveCount(0);
  await expect(page.locator("#agent-verification")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run agent", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Find PC parts" }).click();
  await expect(page.getByText("No verified GPU listings.", { exact: true })).toBeVisible();
  expect(pcGoal).toBe(goal);
  expect(jevCalls).toBe(0);
  await page.getByRole("button", { name: "Copy debug report" }).click();
  const report = await page.getByLabel("Debug report text").inputValue();
  expect(report).toContain('"budgetCents": 250000');
  expect(report).toContain('"resolution": "1440p"');
  expect(report).toContain("gpu: listing unavailable");
  expect(report).not.toContain("verifyFlightSearch");
});

test("an unsupported goal cannot be executed against the flight verifier", async ({ page }) => {
  await page.route("**/api/text-helper", (route) => mockModels(route, "solve", []));
  await page.goto("/jev-browser-agent");
  await page.getByLabel("Goal", { exact: true }).fill("Book a hotel in Paris");
  await expect(page.getByText("Execution context: unsupported goal", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run agent", exact: true })).toHaveCount(0);
  await expect(page.locator("iframe.agent-sandbox")).toHaveCount(0);
});
