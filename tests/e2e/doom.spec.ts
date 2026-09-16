import { test, expect } from "@playwright/test";
import { DOOM_ACTIONS } from "../../types/doom";
test("Doom human controls shoot, pause, and preserve a comparable run", async ({
  page,
}) => {
  await page.goto("/doom");
  await page.getByRole("button", { name: "Start arena", exact: true }).click();
  await page.getByRole("application").focus();
  await page.keyboard.down("Space");
  await expect(page.locator(".doom-stats > div").first()).toContainText("1");
  await page.keyboard.up("Space");
  await page.getByRole("button", { name: "Pause arena", exact: true }).click();
  const tick = await page.getByTestId("doom-tick").innerText();
  await page.waitForTimeout(450);
  await expect(page.getByTestId("doom-tick")).toHaveText(tick);
  await page
    .getByRole("radio", { name: "Random baseline", exact: true })
    .click();
  await expect(page.getByTestId("doom-tick")).toHaveText("0");
  await expect(page.locator(".doom-scoreboard tbody tr").first()).toContainText(
    "last run",
  );
  await page.getByRole("button", { name: "Start arena", exact: true }).click();
  await expect
    .poll(async () => Number(await page.getByTestId("doom-tick").innerText()))
    .toBeGreaterThan(1);
  await page.getByRole("button", { name: "Pause arena", exact: true }).click();
});
test("Doom batches real frames, displays all probabilities and exposes chaos state", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/run", async (route) => {
    const p = route.request().postDataJSON();
    calls++;
    expect(p.state.frames).toHaveLength(4);
    expect(p.state.frames.map((f: any) => f.tick)).toEqual([3, 4, 5, 6]);
    expect(Object.keys(p.questions.frame_0.criteria)).toEqual([
      ...DOOM_ACTIONS,
    ]);
    expect(
      p.state.frames.every((f: any) => f.features.enemy_distance === "unknown"),
    ).toBe(true);
    await route.fulfill({
      json: {
        answers: Object.fromEntries(
          Object.keys(p.questions).map((key) => [
            key,
            {
              type: "choice",
              choice: "shoot",
              confidence: 0.97,
              probabilities: Object.fromEntries(
                DOOM_ACTIONS.map((a) => [a, a === "shoot" ? 1 : 0]),
              ),
            },
          ]),
        ),
      },
    });
  });
  await page.goto("/doom");
  await page.getByRole("radio", { name: "Jev control", exact: true }).click();
  await page.getByLabel("Chaos mode · hide enemy distance").check();
  await page.getByRole("button", { name: "Start arena", exact: true }).click();
  await expect(page.locator(".doom-current-action")).toContainText(
    "97.0% confidence",
  );
  await page.getByRole("button", { name: "Pause arena", exact: true }).click();
  expect(calls).toBe(1);
  await expect(page.locator(".doom-probabilities > div")).toHaveCount(10);
  await page.locator(".doom-state > summary").click();
  await expect(page.locator(".doom-feature-grid")).toContainText("unknown");
  await page.locator(".doom-trace > summary").click();
  await expect(page.locator(".doom-trace")).toContainText("history only");
  await expect(page.locator(".doom-trace")).toContainText("live candidate");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("Doom never applies delayed or invented model actions", async ({
  page,
}) => {
  await page.route("**/api/run", async (route) => {
    const p = route.request().postDataJSON();
    await route.fulfill({
      json: {
        answers: Object.fromEntries(
          Object.keys(p.questions).map((k) => [
            k,
            {
              type: "choice",
              choice: "run_script",
              confidence: 1,
              probabilities: { run_script: 1 },
            },
          ]),
        ),
      },
    });
  });
  await page.goto("/doom");
  await page.getByRole("radio", { name: "Jev control", exact: true }).click();
  await page.getByRole("button", { name: "Start arena", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Invalid",
    { ignoreCase: true },
  );
  await expect(page.locator(".doom-current-action strong")).toHaveText("Idle");
  await page.getByRole("button", { name: "Pause arena", exact: true }).click();
  await expect(page.locator(".doom-stats > div").first()).toContainText("0");
});

test("Doom rejects stale responses and quick taps survive the tick boundary", async ({
  page,
}) => {
  await page.route("**/api/run", async (route) => {
    const p = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.fulfill({
      json: {
        answers: Object.fromEntries(
          Object.keys(p.questions).map((key) => [
            key,
            {
              type: "choice",
              choice: "shoot",
              confidence: 1,
              probabilities: Object.fromEntries(
                DOOM_ACTIONS.map((a) => [a, a === "shoot" ? 1 : 0]),
              ),
            },
          ]),
        ),
      },
    });
  });
  await page.goto("/doom");
  await page.getByRole("radio", { name: "Jev control", exact: true }).click();
  await page.getByRole("button", { name: "Start arena", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "too old",
  );
  await page.getByRole("button", { name: "Pause arena", exact: true }).click();
  await expect(page.locator(".doom-stats > div").last()).toContainText("—");
  await page.locator(".doom-trace > summary").click();
  await expect(page.locator(".doom-trace")).toContainText("not applied");
  await page.getByRole("radio", { name: "Human control", exact: true }).click();
  await page.getByRole("button", { name: "Start arena", exact: true }).click();
  await page.getByRole("button", { name: "Shoot", exact: true }).click();
  await expect(page.locator(".doom-stats > div").last()).toContainText("100%");
  await page.getByRole("button", { name: "Pause arena", exact: true }).click();
});

test("Doom pauses on provider failure without silently retrying", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/run", async (route) => {
    calls++;
    await route.fulfill({
      status: 402,
      json: {
        error:
          "TypeSafe returned HTTP 402. Check your API configuration or try again.",
      },
    });
  });
  await page.goto("/doom");
  await page.getByRole("radio", { name: "Jev control", exact: true }).click();
  await page.getByRole("button", { name: "Start arena", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("402");
  await expect(page.locator(".doom-state > summary")).toContainText("tick 6");
  await expect(
    page.getByRole("button", { name: "Start arena", exact: true }),
  ).toBeVisible();
  const tick = await page.getByTestId("doom-tick").innerText();
  await page.waitForTimeout(1400);
  await expect(page.getByTestId("doom-tick")).toHaveText(tick);
  expect(calls).toBe(1);
});

test("Doom discards an in-flight decision when controls change", async ({
  page,
}) => {
  let received = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/run", async (route) => {
    const p = route.request().postDataJSON();
    received = true;
    await gate;
    await route
      .fulfill({
        json: {
          answers: Object.fromEntries(
            Object.keys(p.questions).map((key) => [
              key,
              {
                type: "choice",
                choice: "shoot",
                confidence: 1,
                probabilities: Object.fromEntries(
                  DOOM_ACTIONS.map((a) => [a, a === "shoot" ? 1 : 0]),
                ),
              },
            ]),
          ),
        },
      })
      .catch(() => {}); // Browser may already have aborted this request.
  });
  await page.goto("/doom");
  await page.getByRole("radio", { name: "Jev control", exact: true }).click();
  await page.getByRole("button", { name: "Start arena", exact: true }).click();
  await expect.poll(() => received).toBe(true);
  await page.getByRole("radio", { name: "Human control", exact: true }).click();
  release();
  await page.waitForTimeout(450);
  await expect(page.getByTestId("doom-tick")).toHaveText("0");
  await expect(page.locator(".doom-current-action strong")).toHaveText("Idle");
  await expect(page.locator(".doom-trace > summary")).toContainText(
    "0 batches",
  );
});
