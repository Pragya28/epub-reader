import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { createFakeOpfsDirectory, stubOpfs } from "@/tests/utils/fake-opfs";
import { readArchive } from "@/services/backup/backup-archive";
import { importBook } from "../import-book";
import { createCollection, addBookToCollection } from "../collections";
import { exportLibrary } from "../export-library";

// fake-indexeddb doesn't preserve Blob fidelity, and covers have no OPFS path
// to round-trip through — return a real Blob so the covers loop is exercised.
vi.mock("@/services/storage/book-repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/services/storage/book-repository")
  >()),
  getBookCover: vi.fn(async (bookId: string) => ({
    bookId,
    cover: new Blob(["cover-bytes"], { type: "image/jpeg" }),
  })),
}));

// Stub a fake OPFS so importBook writes the EPUB there and getBookFile reads a
// real Blob back — fake-indexeddb doesn't preserve Blob fidelity.
beforeEach(async () => {
  await resetTestDb();
  stubOpfs(createFakeOpfsDirectory());
});

afterEach(() => {
  stubOpfs(undefined);
});

describe("exportLibrary", () => {
  it("packs books, files, collections and preferences into an archive", async () => {
    const fixture = await loadFixture("valid-book.epub");
    const { id } = await importBook(fixture);
    const collectionId = await createCollection("Favorites");
    await addBookToCollection(collectionId, id);

    const data = await readArchive(await exportLibrary());

    expect(data.manifest.books.map((b) => b.id)).toEqual([id]);
    expect(data.files.has(id)).toBe(true);
    expect(await data.files.get(id)!.arrayBuffer()).toEqual(
      await fixture.arrayBuffer(),
    );
    expect(data.manifest.groupings.some((g) => g.name === "Favorites")).toBe(
      true,
    );
    expect(data.manifest.groupingMembers).toContainEqual(
      expect.objectContaining({ groupingId: collectionId, bookId: id }),
    );
    expect(await data.covers.get(id)!.text()).toBe("cover-bytes");
    expect(data.manifest.preferences.fontScale).toBe(1);
    expect(data.manifest.version).toBe(1);
  });
});
