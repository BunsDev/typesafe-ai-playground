import { defineConfig, devices } from "@playwright/test";
const port = process.env.E2E_PORT || "3001";
const production = !!process.env.CI || process.env.E2E_PRODUCTION === "1";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Software WebGL shares CPU with the browser and Next server on CI runners.
  workers: process.env.CI ? 1 : 3,
  timeout: process.env.CI ? 60000 : 30000,
  use: {
    baseURL: "http://127.0.0.1:" + port,
    trace: "retain-on-failure",
    launchOptions: {
      args:
        process.env.CI || process.env.E2E_SOFTWARE_GL
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
