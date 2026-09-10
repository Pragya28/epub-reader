import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import { mkdtemp } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * Sprint 8 Day 6 item 31 — the "export -> clear data -> import" recovery
 * scenario, end to end: import a book and read into it, export a backup,
 * wipe the library, then restore from the backup and confirm the book and
 * its reading position come back. Runs across the mobile/tablet/desktop
 * projects in playwright.config.ts.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "../src/tests/fixtures/valid-book.epub");
const BOOK_TITLE = "The Nature of a Crime";
const MIN_TARGET_PX = 24;

/** Text of the library's "Continue reading" banner, e.g. "3 of 12 · 40%".
 * Returns null when the banner isn't shown (no book / no progress). */
async function continueReadingProgress(page: Page): Promise<string | null> {
  const banner = page.getByRole("button", {
    name: `Continue reading ${BOOK_TITLE}`,
  });
  if ((await banner.count()) === 0) return null;
  return (await banner.innerText()).replace(/\s+/g, " ").trim();
}

/** Parsed { chapter, percent } from the banner text ("3 of 12 · 40%"). */
function parseProgress(text: string): { chapter: number; percent: number } {
  const chapter = Number(/(\d+) of \d+/.exec(text)?.[1] ?? "1");
  const percent = Number(/·\s*(\d+)%/.exec(text)?.[1] ?? "0");
  return { chapter, percent };
}

async function importBook(page: Page) {
  await page.goto("/library");
  const fab = page.getByRole("button", { name: "Add to library" });
  await fab.click();

  // The FAB arc animates each action in from scale(0.4) (arc-fab-group.tsx),
  // so the import button only reaches full size once that transition settles.
  const importButton = page.getByRole("button", { name: "Import Book" });
  await expect(importButton).toBeVisible();
  await expect
    .poll(async () => (await importButton.boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(MIN_TARGET_PX);

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    importButton.click(),
  ]);
  await fileChooser.setFiles(FIXTURE);

  // Import success navigates straight into the reader.
  await expect(page.getByRole("heading", { name: BOOK_TITLE })).toBeVisible({
    timeout: 20_000,
  });
}

test("backup and restore round-trips a book and its progress", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);

  await importBook(page);

  // Read a good way in, then let the debounced progress save flush. The
  // book content lives in the reader iframe; the wheel event over it
  // scrolls that document, which is what the engine's scroll listener
  // and progress save key off.
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(2000);
  await page.goBack();

  // Confirm progress actually advanced before we rely on it as the
  // restore signal — otherwise the round-trip proves nothing.
  await expect
    .poll(
      async () => {
        const text = await continueReadingProgress(page);
        return text ? parseProgress(text).percent : 0;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);

  const beforeText = await continueReadingProgress(page);
  expect(beforeText).not.toBeNull();
  const before = parseProgress(beforeText!);

  // Export — capture the download and persist it with its real .zip name.
  await page.goto("/settings");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export" }).click(),
  ]);
  const downloadDir = await mkdtemp(path.join(os.tmpdir(), "librune-backup-"));
  const backupPath = path.join(
    downloadDir,
    download.suggestedFilename() || "backup.zip",
  );
  await download.saveAs(backupPath);
  await expect(page.getByText("Backup saved")).toBeVisible();

  // Wipe the library via Storage -> "Delete all" -> confirm.
  await page.getByRole("button", { name: "Delete all" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();

  await page.goto("/library");
  await expect(page.getByRole("heading", { name: BOOK_TITLE })).toHaveCount(0);

  // Restore from the captured backup.
  await page.goto("/settings");
  const [restoreChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Import", exact: true }).click(),
  ]);
  await restoreChooser.setFiles(backupPath);
  await expect(page.getByText(/Backup restored/i)).toBeVisible({
    timeout: 20_000,
  });

  // Book is back in the library...
  await page.goto("/library");
  await expect(page.getByRole("link", { name: BOOK_TITLE })).toBeVisible({
    timeout: 20_000,
  });

  // ...and its reading position came back with it.
  const afterText = await continueReadingProgress(page);
  expect(
    afterText,
    "continue-reading banner missing after restore",
  ).not.toBeNull();
  const after = parseProgress(afterText!);
  expect(after.percent).toBe(before.percent);
  expect(after.chapter).toBe(before.chapter);

  testInfo.attach("progress", {
    body: `before="${beforeText}" after="${afterText}"`,
    contentType: "text/plain",
  });
});
