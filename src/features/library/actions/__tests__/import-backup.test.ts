import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { createFakeOpfsDirectory, stubOpfs } from "@/tests/utils/fake-opfs";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { getAllBooks } from "@/services/storage/book-repository";
import { getBookFile } from "@/services/storage/book-files";
import {
  resetBookProgress,
  updateBookProgress,
} from "@/services/storage/book-repository";
import { listGroupings } from "@/services/storage/groupings";
import { preferencesStore } from "@/features/preferences/store/preferences-store";
import { importBook } from "../import-book";
import { createCollection, addBookToCollection } from "../collections";
import { exportLibrary } from "../export-library";
import { resetLibrary } from "../reset-library";
import { readBackup, applyBackup } from "../import-backup";

const buildIndex = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/services/search/search-service", () => ({ buildIndex }));

/* fake-indexeddb doesn't preserve Blob fidelity, and covers have no OPFS path
   to round-trip through — return a real Blob so the covers loop is exercised. */
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
  localStorage.clear();
});

afterEach(() => stubOpfs(undefined));

async function archiveOf(setup: () => Promise<void>): Promise<Blob> {
  await setup();
  const blob = await exportLibrary();
  await resetLibrary();
  return blob;
}

describe("readBackup + applyBackup", () => {
  it("restores books, files, and collections onto an empty library", async () => {
    let bookId = "";
    const archive = await archiveOf(async () => {
      const r = await importBook(await loadFixture("valid-book.epub"));
      bookId = r.id;
      const c = await createCollection("Favorites");
      await addBookToCollection(c, bookId);
    });

    buildIndex.mockClear(); // ignore the setup importBook's background index
    const { data, conflicts } = await readBackup(archive);
    expect(conflicts).toEqual([]);
    const summary = await applyBackup(data, new Map());

    expect(summary.restored).toBe(1);
    const books = await getAllBooks();
    expect(books).toHaveLength(1);
    expect(books[0].id).not.toBe(bookId); // fresh id
    expect(await getBookFile(books[0].id)).toBeTruthy();
    expect((await listGroupings("collection"))[0]?.name).toBe("Favorites");
    expect(buildIndex).toHaveBeenCalledTimes(1);
  });

  it("skips a book already present at the same chapter", async () => {
    const archive = await archiveOf(async () => {
      await importBook(await loadFixture("valid-book.epub"));
    });
    await importBook(await loadFixture("valid-book.epub")); // same file, local

    const { data } = await readBackup(archive);
    const summary = await applyBackup(data, new Map());

    expect(summary.skipped).toBe(1);
    expect(summary.restored).toBe(0);
    expect(await getAllBooks()).toHaveLength(1);
  });

  it("reports a chapter-level progress conflict and applies the chosen side", async () => {
    let archiveBookId = "";
    const archive = await archiveOf(async () => {
      const r = await importBook(await loadFixture("valid-book.epub"));
      archiveBookId = r.id;
      await updateBookProgress(archiveBookId, {
        chapterIndex: 5,
        totalChapters: 10,
        scrollFraction: 0,
        anchorPath: null,
        atDocumentEnd: false,
        percent: 50,
        updatedAt: Date.now(),
      });
    });
    const local = await importBook(await loadFixture("valid-book.epub"));

    const { data, conflicts } = await readBackup(archive);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      localId: local.id,
      backupChapter: 5,
      localChapter: 0,
    });

    await applyBackup(data, new Map([[conflicts[0].localId, "take-backup"]]));
    const [book] = await getAllBooks();
    expect(book.progress?.chapterIndex).toBe(5);
  });

  it("keeps local progress when the conflict is resolved 'keep'", async () => {
    const archive = await archiveOf(async () => {
      const r = await importBook(await loadFixture("valid-book.epub"));
      await updateBookProgress(r.id, {
        chapterIndex: 5,
        totalChapters: 10,
        scrollFraction: 0,
        anchorPath: null,
        atDocumentEnd: false,
        percent: 50,
        updatedAt: Date.now(),
      });
    });
    await importBook(await loadFixture("valid-book.epub"));

    const { data, conflicts } = await readBackup(archive);
    const summary = await applyBackup(
      data,
      new Map([[conflicts[0].localId, "keep"]]),
    );

    const [book] = await getAllBooks();
    expect(book.progress?.chapterIndex).toBe(0);
    expect(summary.skipped).toBe(1);
  });

  it("resets local progress on take-backup when the backup book has none", async () => {
    let archiveBookId = "";
    const archive = await archiveOf(async () => {
      const r = await importBook(await loadFixture("valid-book.epub"));
      archiveBookId = r.id;
      await resetBookProgress(archiveBookId); // manifest row: progress undefined
    });
    const local = await importBook(await loadFixture("valid-book.epub"));
    await updateBookProgress(local.id, {
      chapterIndex: 5,
      totalChapters: 10,
      scrollFraction: 0,
      anchorPath: null,
      atDocumentEnd: false,
      percent: 50,
      updatedAt: Date.now(),
    });

    const { data, conflicts } = await readBackup(archive);
    expect(conflicts).toHaveLength(1);

    const summary = await applyBackup(
      data,
      new Map([[conflicts[0].localId, "take-backup"]]),
    );
    const [book] = await getAllBooks();
    expect(book.progress?.chapterIndex).toBeFalsy();
    expect(summary.conflictsResolved).toBe(1);
  });

  it("applies preferences only when none are stored locally", async () => {
    const archive = await archiveOf(async () => {
      await importBook(await loadFixture("valid-book.epub"));
      preferencesStore.getState().setFontScale(1.4);
    });
    // export wrote librune-preferences; simulate a fresh device
    preferencesStore.setState({ fontScale: 1 });
    localStorage.removeItem("librune-preferences");

    const { data } = await readBackup(archive);
    await applyBackup(data, new Map());
    expect(preferencesStore.getState().fontScale).toBe(1.4);
  });

  it("does not touch preferences when they are stored locally", async () => {
    const archive = await archiveOf(async () => {
      await importBook(await loadFixture("valid-book.epub"));
      preferencesStore.getState().setFontScale(1.4);
    });
    localStorage.setItem("librune-preferences", "{}");
    preferencesStore.setState({ fontScale: 1 });

    const { data } = await readBackup(archive);
    await applyBackup(data, new Map());
    expect(preferencesStore.getState().fontScale).toBe(1);
  });

  it("counts a book whose file entry is missing as failed", async () => {
    const archive = await archiveOf(async () => {
      await importBook(await loadFixture("valid-book.epub"));
    });
    const { data } = await readBackup(archive);
    data.files.clear();

    const summary = await applyBackup(data, new Map());
    expect(summary.failed).toBe(1);
    expect(summary.restored).toBe(0);
  });

  it("re-throws a format error from a bad file", async () => {
    await expect(readBackup(new Blob(["nope"]))).rejects.toThrow(
      /isn't a Librune backup/,
    );
  });
});
