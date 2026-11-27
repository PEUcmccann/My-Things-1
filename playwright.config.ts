import { defineConfig, devices } from "@playwright/test";

// The UI checks run against the exported web build at iPhone size.
// @playwright/test is pinned to the version whose Chromium is preinstalled in cloud sessions.
// UI_PORT lets agents in parallel worktrees run the checks without sharing a server.
const port = Number(process.env.UI_PORT ?? 8081);

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    ...devices["iPhone 13"],
    // Chromium can emulate the iPhone screen and touch; WebKit is not needed.
    defaultBrowserType: "chromium",
    baseURL: `http://localhost:${port}`,
    screenshot: "only-on-failure",
  },
  webServer: {
    // EXPO_PUBLIC_FAKE_BACKEND swaps Supabase for fakes (src/app/backendConfig.ts) in this build only.
    command: `EXPO_PUBLIC_FAKE_BACKEND=1 npx expo export --platform web && PORT=${port} node scripts/serve-web.mjs`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
