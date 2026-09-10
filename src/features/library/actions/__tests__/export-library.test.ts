import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { readArchive } from "@/services/backup/backup-archive";
import { importBook } from "../import-book";
import { createCollection, addBookToCollection } from "../collections";
import { exportLibrary } from "../export-library";

beforeEach(async () => {
  await resetTestDb();
});

describe("exportLibrary", () => {
  it("packs books, files, collections and preferences into an archive", async () => {
    const { id } = await importBook(await loadFixture("valid-book.epub"));
    const collectionId = await createCollection("Favorites");
    await addBookToCollection(collectionId, id);

    const data = await readArchive(await exportLibrary());

    expect(data.manifest.books.map((b) => b.id)).toEqual([id]);
    expect(data.files.has(id)).toBe(true);
    expect(data.manifest.groupings.some((g) => g.name === "Favorites")).toBe(
      true,
    );
    expect(data.manifest.groupingMembers).toContainEqual(
      expect.objectContaining({ groupingId: collectionId, bookId: id }),
    );
    expect(data.manifest.preferences.fontScale).toBe(1);
    expect(data.manifest.version).toBe(1);
  });
});
