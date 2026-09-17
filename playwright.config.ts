import { defineConfig, devices } from "@playwright/test";
const port = process.env.E2E_PORT || "3001";
const production = !!process.env.CI || process.env.E2E_PRODUCTION === "1";
/**
 * Software WebGL shares CPU with the browser and the Next server, and a
 * swiftshader context alone costs well over a second to create. Everything that
 * compensates for that has to travel with the renderer, not with CI: gating the
 * flag on CI but the worker count and timeout on CI alone left
 * E2E_SOFTWARE_GL=1 running slow software GL at full parallelism, so the one
 * switch meant to reproduce CI locally was the one combination that could not.
 */
const softwareGl = !!process.env.CI || !!process.env.E2E_SOFTWARE_GL;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: softwareGl ? 1 : 3,
  timeout: softwareGl ? 60000 : 30000,
  // The per-assertion timeout is separate from the per-test one above, and it
  // is the one that matters here: creating a swiftshader context costs ~1.7s
  // before the scene is even built, so `toHaveAttribute("data-status",
  // "ready")` can outlast the 5s default while the test's own 60s budget sits
  // untouched. On CI this surfaced as a first-attempt failure that the retry
  // hid rather than a red build.
  expect: { timeout: softwareGl ? 20000 : 5000 },
  use: {
    baseURL: "http://127.0.0.1:" + port,
    trace: "retain-on-failure",
    launchOptions: {
      args: softwareGl
        ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        : [],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command:
      "npm run " +
      (production ? "start" : "dev") +
      " -- --hostname 127.0.0.1 --port " +
      port,
    url: "http://127.0.0.1:" + port,
    reuseExistingServer: !production,
    timeout: 60000,
  },
});
