import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/health", (r) =>
    r.fulfill({ json: { ok: true, configured: true } }),
  );
});
test("five workspaces fit the viewport and navigate without runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of [
    "/",
    "/conversation",
    "/workflow",
    "/extraction",
    "/memes",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});
test("extraction sends closed sets and renders exact evidence", async ({
  page,
}) => {
  const fields: string[] = [];
  await page.route("**/api/run", async (route) => {
    const p = route.request().postDataJSON();
    fields.push(p.state.field);
    expect(p.questions.extraction.criteria.null).toBeTruthy();
    const choices = p.questions.extraction.criteria;
    const id = Object.keys(choices).find((k) => k !== "null")!;
    await route.fulfill({
      json: {
        answers: {
          extraction: {
            type: "choice",
            choice: id,
            probabilities: { [id]: 0.91 },
            confidence: 0.8,
          },
        },
      },
    });
  });
  await page.goto("/extraction");
  await page
    .getByRole("button", { name: "Run extraction", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  expect(fields.sort()).toEqual([
    "amount",
    "counterparty",
    "date",
    "document_type",
  ]);
  await expect(page.locator("blockquote")).toHaveCount(4);
  await expect(page.locator("tbody")).toContainText("Northstar Studio LLC");
  await expect(page.locator("tbody")).toContainText("91.0%");
  await page
    .getByLabel("Paste document text")
    .fill("No structured values are present here.");
  await page
    .getByRole("button", { name: "Run extraction", exact: true })
    .click();
  await expect(page.locator(".null-value")).toHaveCount(4);
  expect(fields).toHaveLength(4);
});
test("meme test displays classifications and preserves a clear failure state", async ({
  page,
}) => {
  await page.route("**/api/run", async (route) => {
    const p = route.request().postDataJSON();
    expect(Object.keys(p.questions)).toHaveLength(4);
    await route.fulfill({
      json: {
        answers: {
          lands: { type: "noul", noul: 0.84 },
          style: {
            type: "choice",
            choice: "relatable",
            probabilities: { relatable: 0.9 },
          },
          tone: {
            type: "choice",
            choice: "playful",
            probabilities: { playful: 0.8 },
          },
          confusion: {
            type: "choice",
            choice: "none",
            probabilities: { none: 0.7 },
          },
        },
      },
    });
  });
  await page.goto("/memes");
  await page.getByRole("button", { name: "Test meme", exact: true }).click();
  await expect(page.locator(".meme-verdict")).toContainText("84.0%");
  await expect(page.locator(".classification").first()).toHaveText("relatable");
  await page.unroute("**/api/run");
  await page.route("**/api/run", (r) =>
    r.fulfill({
      status: 429,
      json: { error: "Rate limit reached. Try again." },
    }),
  );
  await page.getByRole("button", { name: "Test meme", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Rate limit reached",
  );
  await expect(page.locator(".meme-verdict")).toHaveCount(0);
});
test("workflow renders supported policy action without executing it", async ({
  page,
}) => {
  await page.route("**/api/run", (r) =>
    r.fulfill({
      json: {
        answers: {
          route: { type: "choice", choice: "delivery" },
          supported: { type: "noul", noul: 0.96 },
          missing: { type: "choice", choice: "other" },
        },
      },
    }),
  );
  await page.goto("/workflow");
  await page
    .getByRole("button", { name: /Delivery damage is confirmed/ })
    .click();
  await expect(page.locator(".recommendation")).toContainText(
    "Fine the delivery service and resend the item.",
  );
  await expect(
    page.getByText(
      "Recommendations only. No refunds, fines, or bans are executed.",
    ),
  ).toBeVisible();
});
test("conversation chooses winner and recomputes threshold without API calls", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/run", (r) => {
    calls++;
    const p = r.request().postDataJSON();
    return r.fulfill({
      json: {
        answers: {
          should_respond: {
            type: "noul",
            noul: p.state.messages.at(-1).speaker === "Tyler" ? 0.96 : 0.3,
          },
          frame: { type: "choice", choice: "request" },
        },
      },
    });
  });
  await page.goto("/conversation");
  await page.getByRole("button", { name: "Pick a recipient" }).click();
  await expect(page.locator(".winner-card")).toContainText("Tyler");
  await page.getByRole("slider").fill("99");
  await expect(page.locator(".winner-card")).toContainText("No reply needed");
  expect(calls).toBe(3);
});
test("example edits persist across refresh", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".connection")).toContainText("Jev connected");
  await page.locator("#example-state").fill("My saved example");
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("typesafe-playground-workspace-v2"),
      ),
    )
    .toContain("My saved example");
  await page.reload();
  await expect(page.locator("#example-state")).toHaveValue("My saved example");
});

test("responsive boundaries and short landscape keep actions reachable", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Viewport matrix runs once.");
  for (const [width, height] of [
    [320, 568],
    [650, 700],
    [651, 700],
    [844, 390],
    [900, 700],
    [1024, 768],
    [1200, 800],
    [1440, 900],
    [2560, 1440],
  ]) {
    await page.setViewportSize({ width, height });
    for (const route of [
      "/",
      "/conversation",
      "/workflow",
      "/extraction",
      "/memes",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}x${height}`,
      ).toBe(true);
      const action = page.getByRole("button", {
        name:
          route === "/"
            ? "Run example"
            : route === "/conversation"
              ? "Pick a recipient"
              : route === "/workflow"
                ? "Send message"
                : route === "/extraction"
                  ? "Run extraction"
                  : "Test meme",
        exact: true,
      });
      await action.scrollIntoViewIfNeeded();
      const bounds = await action.boundingBox();
      expect(bounds, `${route} action bounds`).not.toBeNull();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
    }
  }
});

test("meta meme, image URL OCR review, and GitHub link are usable", async ({
  page,
}) => {
  await page.goto("/memes");
  await expect(
    page.getByRole("link", { name: "View TypeSafe AI Playground on GitHub" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/BunsDev/typesafe-ai-playground",
  );
  await expect(page.getByRole("img", { name: /Meta meme:/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download meta meme" }),
  ).toHaveAttribute("href", "/memes/meta-meme.png");
  const image = await (await page.request.get("/memes/meta-meme.png")).body();
  await page.route("**/api/meme-image", (route) =>
    route.fulfill({ contentType: "image/png", body: image }),
  );
  await page.route(
    "https://cdn.jsdelivr.net/npm/tesseract.js@*/dist/worker.min.js",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `self.onmessage=({data:m})=>self.postMessage({workerId:m.workerId,jobId:m.jobId,action:m.action,status:'resolve',data:m.action==='recognize'?{text:'OCR meme caption'}:{}});`,
      }),
  );
  let calls = 0;
  await page.route("**/api/run", (route) => {
    calls++;
    const p = route.request().postDataJSON();
    expect(p.state.imageText).toBe("Reviewed meme caption");
    expect(p.state.setup).toBe("");
    return route.fulfill({
      json: { answers: { lands: { type: "noul", noul: 0.7 } } },
    });
  });
  await page
    .getByLabel("Image address URL")
    .fill("https://example.com/meme.png");
  await page.getByRole("button", { name: "Read image", exact: true }).click();
  await expect(page.getByLabel("Recognized image text")).toHaveValue(
    "OCR meme caption",
  );
  expect(calls).toBe(0);
  await page.getByLabel("Recognized image text").fill("Reviewed meme caption");
  await page.getByRole("button", { name: "Test meme", exact: true }).click();
  await expect(page.locator(".meme-verdict")).toContainText("70.0%");
  expect(calls).toBe(1);
});

test("question JSON stays synchronized and protects concurrent edits", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".question-edit").first().locator("summary").click();
  await page
    .locator(".question-edit")
    .first()
    .getByLabel("Instructions")
    .fill("Updated instruction");
  await page.getByText("Edit all questions as JSON", { exact: true }).click();
  await expect(page.getByLabel("Questions JSON")).toContainText(
    "Updated instruction",
  );
  await page
    .getByLabel("Questions JSON")
    .fill(
      '[{"id":"test","label":"Test","type":"noul","instructions":"Test question"}]',
    );
  await page
    .getByRole("button", { name: "Apply questions", exact: true })
    .click();
  await expect(page.locator(".experiment-panel .count").first()).toHaveText(
    "1 questions",
  );
  await page.locator(".question-edit").first().locator("summary").click();
  await expect(page.getByLabel("Include this question")).toBeChecked();
});
