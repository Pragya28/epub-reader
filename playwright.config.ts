import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Sprint 8 Day 5 — cross-device validation. The dedicated port keeps this
// from colliding with a `pnpm dev` a developer already has running.
const PORT = 4319;
const baseURL = `http://localhost:${PORT}`;

// This repo's remote sandbox pre-installs Chromium outside Playwright's own
// managed cache (see the environment's browser notes) at a revision newer
// `@playwright/test` releases don't ship a matching download for. Point at
// it directly when present; elsewhere (CI, a normal dev machine) fall back
// to Playwright's own `playwright install`-managed browser.
const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium";
// This sandbox also runs as root, which Chromium's own sandbox refuses
// without --no-sandbox — bundled with the executablePath override since
// both are specific to this environment, not CI or a normal dev machine.
const launchOptions = existsSync(SANDBOX_CHROMIUM)
  ? { executablePath: SANDBOX_CHROMIUM, args: ["--no-sandbox"] }
  : {};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm vite --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], launchOptions },
    },
    {
      // Not an iPad preset: those default to WebKit, and this sandbox only
      // has Chromium available (see the executablePath override above).
      name: "tablet",
      use: { ...devices["Galaxy Tab S9"], launchOptions },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], launchOptions },
    },
  ],
});
