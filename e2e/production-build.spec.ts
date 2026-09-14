import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Sprint 8 Day 7 item 35 — production build validation. `pnpm build` runs
 * on every pre-push hook already, so the build itself (tsc + vite build) is
 * continuously validated — what's missing is exercising the actual built
 * output. cross-device.spec.ts and backup-restore.spec.ts both run against
 * `pnpm vite` (source-served dev mode), which never registers the service
 * worker (`devOptions.enabled: false` in vite.config.ts) and skips the real
 * chunk-split/minified bundle entirely. This spec runs via
 * playwright.build.config.ts, whose webServer serves the real `dist/`
 * output through `vite preview` — the one thing only a built-and-served
 * app can prove.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "../src/tests/fixtures/valid-book.epub");
const BOOK_TITLE = "The Nature of a Crime";

/**
 * Expected on every run here, neither a real bug:
 * - The reader iframe's `sandbox="allow-same-origin"` (reader-frame.tsx,
 *   deliberately no `allow-scripts`) blocks EPUB content from executing
 *   scripts — exactly the security hardening it's there for, firing the
 *   moment a book opens. Its console message carries no URL to filter by.
 */
// The second alternative is Chrome's generic failed-resource-load message,
// carrying no URL — real failed loads are caught by the network-level
// check (unexpectedFailedRequests) below instead.
const EXPECTED_CONSOLE_NOISE =
  /Blocked script execution .* sandboxed|Failed to load resource/;

/**
 * @vercel/speed-insights fails its script fetch outside real Vercel infra
 * (local preview, CI) by design — it's meant to no-op there. Chrome's
 * console message for a failed resource load carries no URL ("Failed to
 * load resource: the server responded with a status of 404"), so this is
 * checked at the network level instead of via console text matching.
 */
const EXPECTED_FAILED_REQUEST = /\/_vercel\/speed-insights\//;

test("production build serves the app, registers a service worker, and imports a book", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !EXPECTED_CONSOLE_NOISE.test(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });

  const unexpectedFailedRequests: string[] = [];
  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      !EXPECTED_FAILED_REQUEST.test(response.url())
    ) {
      unexpectedFailedRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/library");
  await expect(page.getByText("Your library is empty")).toBeVisible();

  // The dev server never registers a service worker (devOptions.enabled:
  // false) — this only proves anything against the real built output.
  // `ready` can resolve a tick before `.state` flips from "activating" to
  // "activated", so poll briefly rather than trusting one snapshot.
  await expect(async () => {
    const swState = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return "unsupported";
      const registration = await navigator.serviceWorker.ready;
      return registration.active?.state ?? "no-active-worker";
    });
    expect(swState).toBe("activated");
  }).toPass({ timeout: 10_000 });

  const fab = page.getByRole("button", { name: "Add to library" });
  await fab.click();
  const importButton = page.getByRole("button", { name: "Import Book" });
  await expect(importButton).toBeVisible();

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    importButton.click(),
  ]);
  await fileChooser.setFiles(FIXTURE);

  await expect(page.getByRole("heading", { name: BOOK_TITLE })).toBeVisible({
    timeout: 20_000,
  });

  expect(consoleErrors).toEqual([]);
  expect(unexpectedFailedRequests).toEqual([]);
});
