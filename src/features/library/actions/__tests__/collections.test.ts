import { beforeEach, describe, expect, it } from "vitest";
import {
  addBookToCollection,
  createCollection,
  deleteCollection,
  removeBookFromCollection,
  renameCollection,
} from "../collections";
import {
  getGrouping,
  getMembersForGrouping,
  upsertSeriesMembership,
} from "@/services/storage/groupings";
import { resetTestDb } from "@/tests/utils/reset-test-db";

describe("collections actions", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("creates a collection", async () => {
    const id = await createCollection("Favorites");
    const grouping = await getGrouping(id);

    expect(grouping).toMatchObject({ type: "collection", name: "Favorites" });
  });

  it("renames a collection", async () => {
    const id = await createCollection("Favorites");
    await renameCollection(id, "Comfort Reads");

    expect(await getGrouping(id)).toMatchObject({ name: "Comfort Reads" });
  });

  it("deletes a collection and its membership rows", async () => {
    const id = await createCollection("Favorites");
    await addBookToCollection(id, "book-1");

    await deleteCollection(id);

    expect(await getGrouping(id)).toBeUndefined();
    expect(await getMembersForGrouping(id)).toHaveLength(0);
  });

  it("adds books in sequential order", async () => {
    const id = await createCollection("Favorites");
    await addBookToCollection(id, "book-1");
    await addBookToCollection(id, "book-2");

    const members = await getMembersForGrouping(id);
    expect(members.find((m) => m.bookId === "book-1")?.order).toBe(0);
    expect(members.find((m) => m.bookId === "book-2")?.order).toBe(1);
  });

  it("removes a book from a collection", async () => {
    const id = await createCollection("Favorites");
    await addBookToCollection(id, "book-1");

    await removeBookFromCollection(id, "book-1");

    expect(await getMembersForGrouping(id)).toHaveLength(0);
  });

  it("refuses to rename/delete/add-to a series", async () => {
    const seriesId = await upsertSeriesMembership("book-1", "Foundation", 1);

    await expect(renameCollection(seriesId, "x")).rejects.toThrow();
    await expect(deleteCollection(seriesId)).rejects.toThrow();
    await expect(addBookToCollection(seriesId, "book-2")).rejects.toThrow();
  });
});
