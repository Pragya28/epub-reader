import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveReaderProgress } from "../save-reader-progress";
import { saveBookMetadata } from "@/services/storage/book-repository";
import { libraryStore } from "@/features/library/store/library-store";
import {
  enrichBookWithProgress,
  pickCurrentlyReadingBook,
} from "@/features/library/utils/derive-book-status";
import type { StoredBook } from "@/services/storage/storage-types";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { resetLibraryStore } from "@/tests/utils/reset-store";

vi.mock("@/shared/logger/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

/**
 * Neither half's own unit tests exercise the actual seam: a real reader
 * progress write must round-trip through libraryStore + deriveReadingStatus
 * and land on the right "continue reading" book. save-reader-progress.test.ts
 * mocks updateBookProgress; derive-book-status.test.ts builds StoredBook
 * objects by hand. Here nothing is mocked except the logger.
 */
describe("reader progress → library seam", () => {
  const book = (overrides: Partial<StoredBook>): StoredBook => ({
    id: overrides.id ?? "book",
    title: "Title",
    author: "Author",
    language: "en",
    createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // old enough to not be "new"
    fileHash: `hash-${overrides.id ?? "book"}`,
    ...overrides,
  });

  beforeEach(async () => {
    await resetTestDb();
    resetLibraryStore();
  });

  afterEach(() => {
    resetLibraryStore();
  });

  it("a progress save updates the store, and the enriched book reflects it", async () => {
    const stored = book({ id: "b1" });
    await saveBookMetadata(stored);
    libraryStore.getState().setBooks([stored]);

    await saveReaderProgress("b1", {
      chapterIndex: 3,
      totalChapters: 10,
      scrollFraction: 0.4,
      atDocumentEnd: false,
      percent: 34,
      updatedAt: Date.now(),
    });

    const updated = libraryStore.getState().books.find((b) => b.id === "b1");
    expect(updated?.progress?.percent).toBe(34);

    const enriched = enrichBookWithProgress(updated!);
    expect(enriched.status).toBe("reading");
    expect(enriched.isReading).toBe(true);
    expect(enriched.progress).toBe(34);
  });

  it("clears a manual 'finished' status when new progress is saved", async () => {
    const stored = book({ id: "b1", manualStatus: "finished" });
    await saveBookMetadata(stored);
    libraryStore.getState().setBooks([stored]);

    await saveReaderProgress("b1", {
      chapterIndex: 1,
      totalChapters: 10,
      scrollFraction: 0.1,
      atDocumentEnd: false,
      percent: 11,
      updatedAt: Date.now(),
    });

    const updated = libraryStore.getState().books.find((b) => b.id === "b1");
    const enriched = enrichBookWithProgress(updated!);

    // manualStatus is cleared by a real progress write, so the book falls
    // back to deriving status from the fresh progress instead of staying
    // pinned to "finished" — otherwise re-reading a marked-finished book
    // would never show it as "reading" again.
    expect(updated?.manualStatus).toBeUndefined();
    expect(enriched.status).toBe("reading");
  });

  it("picks the most-recently-saved book as the continue-reading candidate", async () => {
    const older = book({ id: "older" });
    const newer = book({ id: "newer" });
    await saveBookMetadata(older);
    await saveBookMetadata(newer);
    libraryStore.getState().setBooks([older, newer]);

    await saveReaderProgress("older", {
      chapterIndex: 1,
      totalChapters: 10,
      scrollFraction: 0.1,
      atDocumentEnd: false,
      percent: 11,
      updatedAt: 1000,
    });
    await saveReaderProgress("newer", {
      chapterIndex: 5,
      totalChapters: 10,
      scrollFraction: 0.5,
      atDocumentEnd: false,
      percent: 55,
      updatedAt: 2000,
    });

    const enriched = libraryStore.getState().books.map(enrichBookWithProgress);
    const current = pickCurrentlyReadingBook(enriched);

    expect(current?.id).toBe("newer");
  });

  it("does not surface a finished book as the continue-reading candidate", async () => {
    const finished = book({ id: "finished" });
    await saveBookMetadata(finished);
    libraryStore.getState().setBooks([finished]);

    await saveReaderProgress("finished", {
      chapterIndex: 9,
      totalChapters: 10,
      scrollFraction: 1,
      atDocumentEnd: true,
      percent: 100,
      updatedAt: Date.now(),
    });

    const enriched = libraryStore.getState().books.map(enrichBookWithProgress);
    const current = pickCurrentlyReadingBook(enriched);

    expect(current).toBeNull();
  });
});
