import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// fake-indexeddb returns cover blobs as plain objects in this Node version,
// which URL.createObjectURL rejects — irrelevant to the offline guarantee
// under test, so stub just the cover-URL read.
vi.mock("@/services/storage/book-repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/services/storage/book-repository")
  >()),
  getBookCoverUrl: vi.fn(() => Promise.resolve(undefined)),
}));

import { importBook } from "@/features/library/actions/import-book";
import { loadLibrary } from "@/features/library/actions/load-library";
import { searchLibrary } from "@/features/library/actions/search-library";
import { libraryStore } from "@/features/library/store/library-store";
import { getBookFile } from "@/services/storage/book-files";
import { EpubParser } from "@/services/epub/epub-parser";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { resetLibraryStore, resetPwaStore } from "@/tests/utils/reset-store";
import { clearCoverCache } from "@/services/storage/cover-cache";
import { enrichBookWithProgress } from "@/features/library/utils/derive-book-status";

/**
 * "Airplane mode" guarantee: once a book is imported, browsing / parsing /
 * searching must not touch the network. Any `fetch` here is a regression —
 * EPUB blobs and covers live in OPFS/IndexedDB and are never re-fetched.
 */
describe("offline: import once, then browse / parse / search with no network", () => {
  beforeEach(async () => {
    await resetTestDb();
    resetLibraryStore();
    resetPwaStore();
    clearCoverCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("completes the reading loop with fetch disabled", async () => {
    const file = await loadFixture("valid-book.epub");
    const { id, indexed } = await importBook(file);
    await indexed;

    // Go offline: any network call from here on is a regression.
    const fetchSpy = vi.fn(() =>
      Promise.reject(new Error("network unavailable")),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await loadLibrary();
    expect(libraryStore.getState().books).toHaveLength(1);
    expect(libraryStore.getState().error).toBeNull();

    // The reader's data path: the blob comes from local storage (no fetch),
    // and parsing it needs no network. (Parsing the in-scope `file` rather
    // than the round-tripped blob — fake-indexeddb mangles Blob fidelity in
    // this env, unrelated to the offline guarantee.)
    const stored = await getBookFile(id);
    expect(stored?.file).toBeDefined();
    const parsed = await new EpubParser().parseBook(file);
    expect(parsed.chapters.length).toBeGreaterThan(0);

    const enriched = libraryStore.getState().books.map(enrichBookWithProgress);
    const results = await searchLibrary(enriched, "the");
    expect(Array.isArray(results.metadataMatches)).toBe(true);
    expect(Array.isArray(results.contentMatches)).toBe(true);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("imports a book with fetch disabled (dynamic parser/index chunks)", async () => {
    // importBook now pulls the EPUB parser and search-service via dynamic
    // import(). vite-plugin-pwa precaches those chunks, so import must still
    // work offline and touch no network.
    const fetchSpy = vi.fn(() =>
      Promise.reject(new Error("network unavailable")),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const file = await loadFixture("valid-book.epub");
    const { id, indexed } = await importBook(file);
    await indexed;

    expect(id).toBeTruthy();
    expect(libraryStore.getState().books).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
