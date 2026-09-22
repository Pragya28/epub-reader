import { beforeEach, describe, expect, it } from "vitest";
import { reconcileOrphanedRows } from "../reconcile";
import { db } from "../db";
import { resetTestDb } from "@/tests/utils/reset-test-db";

describe("reconcileOrphanedRows", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("deletes dependent rows whose book no longer exists, keeps rows for live books", async () => {
    await db.books.put({
      id: "live-book",
      title: "Live",
      createdAt: 1,
      fileHash: "h1",
    });

    await db.searchIndex.bulkAdd([
      { word: "orphan", bookId: "gone-book", chapter: 0 },
      { word: "live", bookId: "live-book", chapter: 0 },
    ]);
    await db.chapterText.bulkAdd([
      { bookId: "gone-book", chapter: 0, text: "orphan", label: "" },
      { bookId: "live-book", chapter: 0, text: "live", label: "" },
    ]);
    await db.groupingMembers.bulkAdd([
      { groupingId: "g1", bookId: "gone-book", order: null },
      { groupingId: "g1", bookId: "live-book", order: null },
    ]);

    const result = await reconcileOrphanedRows();

    expect(result).toMatchObject({
      searchIndexRows: 1,
      chapterTextRows: 1,
      groupingMemberRows: 1,
    });

    expect(await db.searchIndex.where({ bookId: "gone-book" }).count()).toBe(0);
    expect(await db.searchIndex.where({ bookId: "live-book" }).count()).toBe(1);
    expect(await db.chapterText.where({ bookId: "gone-book" }).count()).toBe(0);
    expect(await db.chapterText.where({ bookId: "live-book" }).count()).toBe(1);
    expect(
      await db.groupingMembers.where({ bookId: "gone-book" }).count(),
    ).toBe(0);
    expect(
      await db.groupingMembers.where({ bookId: "live-book" }).count(),
    ).toBe(1);
  });

  it("is a no-op when there are no orphans", async () => {
    await db.books.put({
      id: "live-book",
      title: "Live",
      createdAt: 1,
      fileHash: "h1",
    });
    await db.searchIndex.add({ word: "live", bookId: "live-book", chapter: 0 });

    const result = await reconcileOrphanedRows();

    expect(result.searchIndexRows).toBe(0);
    expect(await db.searchIndex.count()).toBe(1);
  });
});
