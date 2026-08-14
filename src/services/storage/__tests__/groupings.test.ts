import { beforeEach, describe, expect, it } from "vitest";
import {
  addMember,
  deleteGrouping,
  getGrouping,
  getMembersForBook,
  getMembersForGrouping,
  hasSeriesMembership,
  isCollection,
  listGroupings,
  putGrouping,
  removeMember,
  upsertSeriesMembership,
} from "../groupings";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import type { Grouping } from "../storage-types";

describe("groupings", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("puts and gets a grouping", async () => {
    const grouping: Grouping = {
      id: "g1",
      type: "collection",
      name: "Favorites",
      createdAt: 1,
    };

    await putGrouping(grouping);

    expect(await getGrouping("g1")).toEqual(grouping);
  });

  it("lists groupings filtered by type", async () => {
    await putGrouping({
      id: "g1",
      type: "collection",
      name: "Favorites",
      createdAt: 1,
    });
    await putGrouping({
      id: "g2",
      type: "series",
      name: "Foundation",
      createdAt: 2,
    });

    const collections = await listGroupings("collection");
    expect(collections).toHaveLength(1);
    expect(collections[0].id).toBe("g1");

    expect(await listGroupings()).toHaveLength(2);
  });

  it("deletes a grouping", async () => {
    await putGrouping({
      id: "g1",
      type: "collection",
      name: "Favorites",
      createdAt: 1,
    });

    await deleteGrouping("g1");

    expect(await getGrouping("g1")).toBeUndefined();
  });

  it("adds and reads membership from both sides", async () => {
    await addMember("g1", "book-1", 2);

    expect(await getMembersForBook("book-1")).toEqual([
      { groupingId: "g1", bookId: "book-1", order: 2 },
    ]);
    expect(await getMembersForGrouping("g1")).toEqual([
      { groupingId: "g1", bookId: "book-1", order: 2 },
    ]);
  });

  it("removes a specific membership without touching others", async () => {
    await addMember("g1", "book-1", null);
    await addMember("g1", "book-2", null);

    await removeMember("g1", "book-1");

    const remaining = await getMembersForGrouping("g1");
    expect(remaining).toEqual([
      { groupingId: "g1", bookId: "book-2", order: null },
    ]);
  });

  it("isCollection is true only for collection-type groupings", () => {
    expect(
      isCollection({ id: "g1", type: "collection", name: "x", createdAt: 1 }),
    ).toBe(true);
    expect(
      isCollection({ id: "g2", type: "series", name: "x", createdAt: 1 }),
    ).toBe(false);
  });

  describe("upsertSeriesMembership", () => {
    it("creates a new series grouping on first use", async () => {
      await upsertSeriesMembership("book-1", "Foundation Series", 1);

      const series = await listGroupings("series");
      expect(series).toHaveLength(1);
      expect(series[0].name).toBe("Foundation Series");

      const members = await getMembersForBook("book-1");
      expect(members).toEqual([
        { groupingId: series[0].id, bookId: "book-1", order: 1 },
      ]);
    });

    it("reuses an existing series matched case-insensitively", async () => {
      await upsertSeriesMembership("book-1", "Foundation Series", 1);
      await upsertSeriesMembership("book-2", "foundation series", 2);

      const series = await listGroupings("series");
      expect(series).toHaveLength(1);

      const members = await getMembersForGrouping(series[0].id);
      expect(members).toHaveLength(2);
    });

    it("hasSeriesMembership reflects whether a book has a series row", async () => {
      expect(await hasSeriesMembership("book-1")).toBe(false);

      await upsertSeriesMembership("book-1", "Foundation Series", 1);

      expect(await hasSeriesMembership("book-1")).toBe(true);
    });
  });
});
