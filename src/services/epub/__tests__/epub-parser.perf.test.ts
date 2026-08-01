import { describe, expect, it } from "vitest";
import { EpubParser } from "../epub-parser";
import { loadFixture } from "@/tests/utils/load-fixtures";

/**
 * A regression guard, not a tight perf gate — the threshold is generous on
 * purpose so it doesn't flake on a slow CI runner. Its job is to catch a
 * catastrophic regression (e.g. an accidental O(n²) creeping into asset
 * resolution), not to enforce a specific budget.
 *
 * large-book.epub has ~370 chapters. parseBook() parses every one of them
 * eagerly on open (see SPRINT-03-TASKS.md #1 "Lazy/async book parsing") —
 * this is exactly the cost that gap is about. Once that's fixed to parse
 * lazily, this same test should get dramatically faster; it'll keep working
 * as a benchmark either way.
 */
const PARSE_TIME_BUDGET_MS = 15_000;

describe("EpubParser performance", () => {
  it(
    "parses a ~370-chapter book within a generous time budget",
    async () => {
      const file = await loadFixture("large-book.epub");
      const parser = new EpubParser();

      const start = performance.now();
      const book = await parser.parseBook(file);
      const elapsedMs = performance.now() - start;

      expect(book.chapters.length).toBeGreaterThan(100);
      expect(elapsedMs).toBeLessThan(PARSE_TIME_BUDGET_MS);
    },
    // Vitest's default 5s test timeout is shorter than our own budget
    // assertion above — give the test itself enough room to actually
    // reach that assertion instead of getting killed first.
    PARSE_TIME_BUDGET_MS + 5_000,
  );
});
