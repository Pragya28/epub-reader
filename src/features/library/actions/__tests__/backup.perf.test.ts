import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { createFakeOpfsDirectory, stubOpfs } from "@/tests/utils/fake-opfs";
import { loadFixture } from "@/tests/utils/load-fixtures";
import {
  getAllBooks,
  saveImportedBook,
} from "@/services/storage/book-repository";
import { getBookFile } from "@/services/storage/book-files";
import { enrichBookWithProgress } from "../../utils/derive-book-status";
import { importBook } from "../import-book";
import { exportLibrary } from "../export-library";
import { resetLibrary } from "../reset-library";
import { readBackup, applyBackup } from "../import-backup";
import { searchLibrary } from "../search-library";

/**
 * A regression guard, not a tight perf gate — mirrors the other
 * `*.perf.test.ts` files, but at the scale that actually matters for
 * backup/export: a realistic personal library (10-20 real EPUB files),
 * not thousands of synthetic rows. load-library.perf.test.ts and
 * search.perf.test.ts already cover library-metadata and search-index
 * scale with synthetic data; this covers what neither of them touches —
 * real EPUB/cover blobs through export and restore, plus a sanity check
 * that search still works at this scale.
 *
 * buildIndex is mocked to a no-op everywhere except one explicit real call
 * (see "search finds content" below). Letting every one of ~14 books get
 * fully re-parsed by the real indexer — once on import, again here, and
 * again on restore's own background reindex — multiplies real JSZip work
 * on multi-MB fixtures 3x over and crashed the Vitest worker outright in
 * an earlier version of this test. Indexing correctness is already covered
 * by import-book.test.ts and import-backup.test.ts; this file's job is
 * proving the backup pipeline holds up at realistic book *count*, not
 * re-proving indexing throughput.
 */
const TARGET_BOOK_COUNT = 14;
const SEARCH_TIME_BUDGET_MS = 2_000;
const EXPORT_TIME_BUDGET_MS = 5_000;
const RESTORE_TIME_BUDGET_MS = 5_000;

// invalid.epub is deliberately unparseable and broken-spine.epub exercises a
// different (error-path) test elsewhere — neither belongs in a library-scale
// pipeline test. image-heavy.epub/large-book.epub are real but the heaviest
// fixtures on disk; each is imported once for realistic size variety, but
// not used as a source for the extra "copy" books below.
const FIXTURES = [
  "valid-book.epub",
  "valid-book-2.epub",
  "series-1.epub",
  "series-2.epub",
  "missing-metadata.epub",
  "nested-opf.epub",
  "image-heavy.epub",
  "large-book.epub",
];
const LIGHT_FIXTURES = FIXTURES.filter(
  (f) => f !== "image-heavy.epub" && f !== "large-book.epub",
);

const buildIndex = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/services/search/search-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/search/search-service")>();
  return { ...actual, buildIndex };
});

/* fake-indexeddb doesn't preserve Blob fidelity, and covers have no OPFS path
   to round-trip through — same workaround as import-backup.test.ts: return a
   real Blob so the export/restore covers loop is exercised faithfully. */
vi.mock("@/services/storage/book-repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/services/storage/book-repository")
  >()),
  getBookCover: vi.fn(async (bookId: string) => ({
    bookId,
    cover: new Blob(["cover-bytes"], { type: "image/jpeg" }),
  })),
}));

beforeEach(async () => {
  await resetTestDb();
  stubOpfs(createFakeOpfsDirectory());
  buildIndex.mockClear();
});

afterEach(() => stubOpfs(undefined));

/**
 * Seeds a realistic-scale library: each real fixture imported once (real
 * parse; indexing itself is the no-op mock), then topped up to
 * TARGET_BOOK_COUNT with more copies of the lighter real blobs under fresh
 * ids — saveImportedBook skips importBook's hash-dedupe check, which is
 * exactly what's needed here, so export/restore still see realistic file
 * counts and sizes without every book paying for a real second parse.
 */
interface SeedResult {
  /** id of the valid-book.epub-derived book — small and known-good, the
   * one this file's search test indexes for real (see its own comment). */
  smallBookId: string;
}

async function seedRealisticLibrary(): Promise<SeedResult> {
  const lightIds: string[] = [];
  let smallBookId = "";
  for (const filename of FIXTURES) {
    const file = await loadFixture(filename);
    const { id } = await importBook(file);
    if (LIGHT_FIXTURES.includes(filename)) lightIds.push(id);
    if (filename === "valid-book.epub") smallBookId = id;
  }

  const seeded = await getAllBooks();
  const lightSources = seeded.filter((b) => lightIds.includes(b.id));
  let extraIndex = 0;
  while (seeded.length + extraIndex < TARGET_BOOK_COUNT) {
    const source = lightSources[extraIndex % lightSources.length]!;
    const stored = await getBookFile(source.id);
    if (!stored) continue;

    await saveImportedBook({
      metadata: {
        ...source,
        id: `${source.id}-copy-${extraIndex}`,
        fileHash: `${source.fileHash}-copy-${extraIndex}`,
        progress: undefined,
        manualStatus: undefined,
      },
      file: stored.file,
    });
    extraIndex++;
  }

  return { smallBookId };
}

describe("backup performance at library scale", () => {
  it(`exports and restores a ${TARGET_BOOK_COUNT}-book real-EPUB library within generous time budgets`, async () => {
    await seedRealisticLibrary();

    const allBooks = await getAllBooks();
    expect(allBooks).toHaveLength(TARGET_BOOK_COUNT);

    // Export: real createArchive over real EPUB/cover blobs.
    const exportStart = performance.now();
    const archive = await exportLibrary();
    const exportElapsedMs = performance.now() - exportStart;

    expect(exportElapsedMs).toBeLessThan(EXPORT_TIME_BUDGET_MS);

    // Restore: wipe the library, then read + apply the archive back.
    await resetLibrary();
    expect(await getAllBooks()).toHaveLength(0);

    const restoreStart = performance.now();
    const { data } = await readBackup(archive);
    const summary = await applyBackup(data, new Map());
    const restoreElapsedMs = performance.now() - restoreStart;

    expect(summary.restored).toBe(TARGET_BOOK_COUNT);
    expect(await getAllBooks()).toHaveLength(TARGET_BOOK_COUNT);
    expect(restoreElapsedMs).toBeLessThan(RESTORE_TIME_BUDGET_MS);
  }, 30_000);

  it("search finds content at library scale without a per-query index rebuild", async () => {
    const { smallBookId } = await seedRealisticLibrary();
    const allBooks = await getAllBooks();

    // One real index, for one real (small, known-fast) book — enough to
    // prove ensureIndexesForBooks/findMatches behave correctly and stay
    // fast against a library this size, without paying to fully re-parse
    // every book (see the file-level comment above). Picking a random
    // book here previously landed on the ~370-chapter large-book.epub
    // fixture and blew the time budget on the index build alone.
    const target = allBooks.find((b) => b.id === smallBookId)!;
    const { buildIndex: realBuildIndex } = await vi.importActual<
      typeof import("@/services/search/search-service")
    >("@/services/search/search-service");
    const stored = await getBookFile(target.id);
    await realBuildIndex(target.id, stored!.file);

    const enriched = [target].map(enrichBookWithProgress);
    const searchStart = performance.now();
    const results = await searchLibrary(enriched, target.title.split(" ")[0]!);
    const searchElapsedMs = performance.now() - searchStart;

    expect(
      results.metadataMatches.length + results.contentMatches.length,
    ).toBeGreaterThan(0);
    expect(searchElapsedMs).toBeLessThan(SEARCH_TIME_BUDGET_MS);
  }, 30_000);
});
