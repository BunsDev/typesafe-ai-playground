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
      if (route === "/" && width > 650 && height < 600) {
        expect(
          (await page.locator(".example-list").boundingBox())!.height,
        ).toBeGreaterThan(60);
      }
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
        body: `let passes=0; self.onmessage=({data:m})=>self.postMessage({workerId:m.workerId,jobId:m.jobId,action:m.action,status:'resolve',data:m.action==='recognize'?(++passes===2?{text:'x'.repeat(8001),blocks:[]}:{text:'OCR meme caption\\nOCR punchline',blocks:[{paragraphs:[{lines:[{text:'OCR meme caption',confidence:95,bbox:{x0:20,y0:20,x1:400,y1:60}},{text:'OCR punchline',confidence:95,bbox:{x0:20,y0:800,x1:400,y1:840}}]}]}]}):{}});`,
      }),
  );
  let calls = 0;
  await page.route("**/api/run", (route) => {
    calls++;
    const p = route.request().postDataJSON();
    expect(p.state.imageText).toBe("Reviewed meme caption");
    expect(p.state.setup).toBe("OCR meme caption");
    expect(p.state.punchline).toBe("OCR punchline");
    return route.fulfill({
      json: { answers: { lands: { type: "noul", noul: 0.7 } } },
    });
  });
  await page
    .getByLabel("Image address URL")
    .fill("https://example.com/meme.png");
  await page.getByRole("button", { name: "Read image", exact: true }).click();
  await expect(page.getByLabel("Recognized image text")).toHaveValue(
    "OCR meme caption\n\nOCR punchline",
  );
  await expect(page.getByLabel("Setup / top text")).toHaveValue(
    "OCR meme caption",
  );
  await expect(page.getByLabel("Punchline / bottom text")).toHaveValue(
    "OCR punchline",
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
  await expect(page.locator(".run-readiness")).toContainText(
    "1 question · 1 request",
  );
  await page.locator(".question-edit").first().locator("summary").click();
  await expect(
    page.getByRole("checkbox", { name: "Include question: Test", exact: true }),
  ).toBeChecked();
});

test("unreadable meme text does not report a successful extraction", async ({
  page,
}) => {
  await page.goto("/memes");
  const image = await (await page.request.get("/memes/meta-meme.png")).body();
  await page.route("**/api/meme-image", (route) =>
    route.fulfill({ contentType: "image/png", body: image }),
  );
  await page.route(
    "https://cdn.jsdelivr.net/npm/tesseract.js@*/dist/worker.min.js",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `self.onmessage=({data:m})=>self.postMessage({workerId:m.workerId,jobId:m.jobId,action:m.action,status:'resolve',data:m.action==='recognize'?{text:'--',blocks:[{paragraphs:[{lines:[{text:'--',confidence:95,bbox:{x0:0,y0:0,x1:20,y1:20}}]}]}]}:{}});`,
      }),
  );
  await page
    .getByLabel("Image address URL")
    .fill("https://example.com/unreadable.png");
  await page.getByRole("button", { name: "Read image", exact: true }).click();
  await expect(page.locator(".ocr-status")).toContainText(
    "No caption detected",
  );
  await expect(page.getByLabel("Recognized image text")).toHaveValue("");
  await expect(page.getByLabel("Setup / top text")).toHaveValue("");
  await expect(page.getByLabel("Punchline / bottom text")).toHaveValue("");
});

test("examples expose question selection, validation, and reversible reset", async ({
  page,
}) => {
  await page.goto("/");
  const original = await page.locator("#example-state").inputValue();
  await page.locator("#example-state").fill("A changed draft");
  await expect(page.getByText("Edited draft", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset draft", exact: true }).click();
  await expect(page.locator("#example-state")).toHaveValue(original);
  await page.getByRole("button", { name: "Undo reset" }).click();
  await expect(page.locator("#example-state")).toHaveValue("A changed draft");
  for (const box of await page
    .getByRole("checkbox", { name: /^Include question:/ })
    .all())
    await box.uncheck();
  await expect(
    page.getByRole("button", { name: "Run example", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".run-readiness")).toContainText(
    "Select at least one question",
  );
  await page
    .getByRole("checkbox", { name: /^Include question:/ })
    .first()
    .check();
  await expect(
    page.getByRole("button", { name: "Run example", exact: true }),
  ).toBeEnabled();
});

test("example filters recover from empty results and preview the A/B change", async ({
  page,
}) => {
  await page.goto("/");
  const browse = page.getByRole("button", {
    name: "Browse examples",
    exact: true,
  });
  if (await browse.isVisible()) await browse.click();
  await page.getByLabel("Search examples").fill("no-such-example-123456");
  await expect(
    page.getByText("No matching examples.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByLabel("A/B comparisons only").check();
  await expect(page.locator(".example-item").first()).toContainText(
    "A/B comparison",
  );
  await page.locator(".example-item").first().click();
  await expect(page.locator(".comparison-preview")).toContainText(
    "Only this field changes",
  );
  await expect(
    page.getByRole("button", { name: "Compare A/B", exact: true }),
  ).toBeEnabled();
  await page.locator("#example-state").fill("{}");
  await expect(
    page.getByRole("button", { name: "Compare A/B", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Run example", exact: true }),
  ).toBeEnabled();
});

test("results rail toggles from its bottom edge and with the keyboard", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Full-height rail is a desktop layout.",
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const rail = page.getByRole("button", {
    name: "Expand results",
    exact: true,
  });
  const bounds = (await rail.boundingBox())!;
  const panel = (await page.locator(".example-results").boundingBox())!;
  expect(Math.abs(bounds.height - panel.height)).toBeLessThanOrEqual(2);
  await rail.click({
    position: { x: bounds.width / 2, y: bounds.height - 20 },
  });
  const collapse = page.getByRole("button", {
    name: "Collapse results",
    exact: true,
  });
  await expect(collapse).toHaveAttribute("aria-expanded", "true");
  const open = (await page.locator(".example-results").boundingBox())!;
  const setup = (await page.locator(".experiment-panel").boundingBox())!;
  expect(Math.abs(open.height - setup.height)).toBeLessThanOrEqual(2);
  await collapse.focus();
  await page.keyboard.press("Enter");
  await expect(rail).toHaveAttribute("aria-expanded", "false");
});
