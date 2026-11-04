import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against a local backend on :8080 (see e2e/README.md). Pages are Server Components, so the Next.js server
 * calls the API itself (`HAYI_API_ORIGIN`).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Mobile-first (D3a): a phone viewport.
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: { HAYI_API_ORIGIN: process.env.HAYI_API_ORIGIN ?? "http://localhost:8080" },
  },
});
