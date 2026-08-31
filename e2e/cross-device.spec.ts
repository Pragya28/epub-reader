import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Sprint 8 Day 5 — cross-device validation. Run across the mobile/tablet/
 * desktop projects in playwright.config.ts, this exercises the app's core
 * loop (import → read → search → organize) once per viewport and checks
 * the two things a real device lab would otherwise be needed for:
 *  - no screen ever grows a horizontal scrollbar (responsive layout), and
 *  - primary touch targets clear the WCAG 2.5.8 24x24 CSS px floor from
 *    .agents/context/ACCESSIBILITY.md.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "../src/tests/fixtures/valid-book.epub");
const BOOK_TITLE = "The Nature of a Crime";
const MIN_TARGET_PX = 24;

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectMinTargetSize(locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  expect(box!.height).toBeGreaterThanOrEqual(MIN_TARGET_PX);
}

test("import, read, search, and organize a book", async ({ page }) => {
  await page.goto("/library");
  await expectNoHorizontalOverflow(page);

  const fabButton = page.getByRole("button", { name: "Add to library" });
  await expectMinTargetSize(fabButton);

  // Import: opens the FAB's arc, then the picked-file's native dialog. The
  // arc animates each action in from scale(0.4) (arc-fab-group.tsx), so its
  // rendered box only reaches full size once that transition settles.
  await fabButton.click();
  const importButton = page.getByRole("button", { name: "Import Book" });
  await expect(importButton).toBeVisible();
  await expect
    .poll(async () => (await importButton.boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(MIN_TARGET_PX);
  await expectMinTargetSize(importButton);

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    importButton.click(),
  ]);
  await fileChooser.setFiles(FIXTURE);

  // Read: import success navigates straight into the reader.
  const readerHeading = page.getByRole("heading", { name: BOOK_TITLE });
  await expect(readerHeading).toBeVisible({ timeout: 20_000 });
  await expectNoHorizontalOverflow(page);

  // The chrome auto-hides shortly after load (scroll-driven reveal/hide —
  // see use-chrome-visibility.ts), so it can't be reliably clicked right
  // after mount without racing that animation. Target-size is still worth
  // auditing without depending on a click landing; returning to the
  // library goes through native history instead, which is unaffected by
  // chrome visibility.
  await expectMinTargetSize(page.getByRole("button", { name: "Go back" }));
  await page.goBack();

  const bookCard = page.getByRole("link", { name: BOOK_TITLE });
  await expect(bookCard).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Search: metadata search needs no index, so this doesn't race the
  // background content-indexing job (see search-service.ts).
  await page.getByRole("link", { name: "Search" }).click();
  const searchInput = page.getByRole("textbox", {
    name: "Search your library",
  });
  await expectMinTargetSize(searchInput);
  await searchInput.fill(BOOK_TITLE);

  const searchResult = page.getByRole("button").filter({ hasText: BOOK_TITLE });
  await expect(searchResult.first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Back" }).click();
  await expect(bookCard).toBeVisible();

  // Organize: add the book to a new collection via its card menu. Only one
  // book is imported, so "More options" is unambiguous without scoping to
  // a specific card.
  const moreOptions = page.getByRole("button", { name: "More options" });
  await expectMinTargetSize(moreOptions);
  await moreOptions.click();

  await page.getByRole("menuitem", { name: "Add to Collection" }).click();
  await page.getByRole("button", { name: "New Collection" }).click();

  const collectionName = "Cross-Device Test Shelf";
  await page.getByLabel("Collection Name").fill(collectionName);
  await page.getByRole("button", { name: "Create" }).click();

  // Creating leaves the "Add to Collection" sheet open (so more collections
  // can be toggled) — it applies aria-hidden to the rest of the page while
  // open, so the Shelves tab is unreachable until it's dismissed.
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: "Shelves" }).click();
  await expect(page.getByText(collectionName)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
