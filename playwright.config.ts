import { defineConfig, devices } from "@playwright/test";

// The UI checks run against the exported web build at iPhone size.
// @playwright/test is pinned to the version whose Chromium is preinstalled in cloud sessions.
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    ...devices["iPhone 13"],
    // Chromium can emulate the iPhone screen and touch; WebKit is not needed.
    defaultBrowserType: "chromium",
    baseURL: "http://localhost:8081",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx expo export --platform web && node scripts/serve-web.mjs",
    url: "http://localhost:8081",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
