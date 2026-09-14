import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Sprint 8 Day 7 item 35 — production build validation. Separate from
// playwright.config.ts (dev-server e2e) because the whole point here is
// serving the real `dist/` output — `pnpm build` already runs, then `vite
// preview` serves it. Run with `pnpm test:e2e:build`. Not wired into the
// pre-push hook or CI's push-triggered job: it's a release-time check (see
// docs/RELEASE_CHECKLIST.md), not a per-commit gate — a full build+preview
// cycle is too slow to run on every push.
const PORT = 4320;
const baseURL = `http://localhost:${PORT}`;

const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium";
const launchOptions = existsSync(SANDBOX_CHROMIUM)
  ? { executablePath: SANDBOX_CHROMIUM, args: ["--no-sandbox"] }
  : {};

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/production-build.spec.ts",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm build && pnpm vite preview --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], launchOptions },
    },
  ],
});
