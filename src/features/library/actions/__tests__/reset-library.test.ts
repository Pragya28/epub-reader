import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { db } from "@/services/storage/db";
import { libraryStore } from "@/features/library/store/library-store";
import { pwaStore } from "@/features/pwa/store/pwa-store";
import { searchMaintenanceStore } from "@/features/library/store/search-maintenance-store";
import { importBook } from "../import-book";
import { createCollection, addBookToCollection } from "../collections";
import { resetLibrary } from "../reset-library";

beforeEach(async () => {
  await resetTestDb();
});

describe("resetLibrary", () => {
  it("empties every table and resets the library stores", async () => {
    const { id, indexed } = await importBook(
      await loadFixture("valid-book.epub"),
    );
    await indexed;
    const c = await createCollection("Favorites");
    await addBookToCollection(c, id);
    libraryStore.getState().setBooks([{ id } as never]);
    pwaStore.getState().setHadBooks(true);
    searchMaintenanceStore.setState({ lastRebuiltAt: Date.now() });

    await resetLibrary();

    for (const table of [
      db.books,
      db.bookFiles,
      db.bookCovers,
      db.searchIndex,
      db.chapterText,
      db.groupings,
      db.groupingMembers,
    ]) {
      expect(await table.count()).toBe(0);
    }
    expect(libraryStore.getState().books).toEqual([]);
    expect(libraryStore.getState().evicted).toBe(false);
    expect(pwaStore.getState().hadBooks).toBe(false);
    expect(searchMaintenanceStore.getState().lastRebuiltAt).toBeNull();
  });
});
