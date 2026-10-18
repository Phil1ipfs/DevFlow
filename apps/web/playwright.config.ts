import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running DevFlow stack (web + API + PostgreSQL).
 *
 *   E2E_BASE_URL  web app URL (default http://localhost:3000)
 *   PW_CHANNEL    optional installed browser, e.g. "msedge" or "chrome", to skip downloading Chromium
 *
 * The API must run in Development or Testing so the dev mailbox (password-reset and invitation
 * links) is available. See docs/testing.md.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // Each test signs up fresh users, so tests are independent; two workers keep load realistic.
  workers: process.env.CI ? 1 : 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /responsive\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL || undefined },
    },
    {
      name: "mobile",
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["Pixel 7"], channel: process.env.PW_CHANNEL || undefined },
    },
  ],
});
