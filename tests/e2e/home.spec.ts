import { test, expect } from "@playwright/test";

test("home discovers examples by type and query and opens the existing builder", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Many possibilities.",
  );
  await expect(page.locator(".home-example-card")).toHaveCount(15);
  await expect(page.locator(".home-section")).toHaveCount(4);
  await page.screenshot({
    path: `/tmp/typesafe-home-${info.project.name}.png`,
  });
  await page
    .getByRole("button", { name: "Games & simulations", exact: true })
    .click();
  await expect(page.locator(".home-example-card")).toHaveCount(3);
  await expect(
    page.getByRole("link", { name: "Open Jev attempts chess" }),
  ).toBeVisible();
  await page.getByLabel("Search examples").fill("robot");
  await expect(page.locator(".home-example-card")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Open MicroDuck arena" }),
  ).toBeVisible();
  await page.getByLabel("Search examples").fill("unfindable-example");
  await expect(
    page.getByRole("heading", { name: "No matching examples" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show all examples" }).click();
  await expect(page.locator(".home-example-card")).toHaveCount(15);
  await page
    .getByRole("link", { name: "Open Example builder", exact: true })
    .click();
  await expect(page).toHaveURL(/\/examples$/);
  await expect(page.locator("#example-state")).toBeVisible();
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  const nav = page.getByRole("navigation", { name: "Workspaces" });
  await expect(
    nav.getByRole("group", { name: "Language & data" }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Example builder", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(errors).toEqual([]);
});
