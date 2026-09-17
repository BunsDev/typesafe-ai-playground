import { test, expect } from "@playwright/test";
import { mockModels } from "./browser-agent-policy";
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
