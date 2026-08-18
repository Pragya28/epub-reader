import { describe, expect, it } from "vitest";
import {
  buildGroupingsWithMeta,
  sortGroupings,
  splitByType,
} from "../sort-groupings";
import type {
  Grouping,
  GroupingMember,
  StoredBook,
} from "@/services/storage/storage-types";

function makeBook(overrides: Partial<StoredBook> = {}): StoredBook {
  return {
    id: "b1",
    title: "Book",
    createdAt: 0,
    fileHash: "h",
    ...overrides,
  };
}

describe("buildGroupingsWithMeta", () => {
  it("derives a series's effective timestamps from its member books' createdAt", () => {
    const series: Grouping = {
      id: "g1",
      type: "series",
      name: "Foundation",
      createdAt: 1,
      updatedAt: 1,
    };
    const members: GroupingMember[] = [
      { groupingId: "g1", bookId: "b1", order: 1 },
      { groupingId: "g1", bookId: "b2", order: 2 },
    ];
    const books = new Map([
      ["b1", makeBook({ id: "b1", createdAt: 100, coverBg: "cover-1" })],
      ["b2", makeBook({ id: "b2", createdAt: 300, coverBg: "cover-2" })],
    ]);

    const [result] = buildGroupingsWithMeta(
      [series],
      new Map([["g1", members]]),
      books,
    );

    expect(result.effectiveCreatedAt).toBe(100);
    expect(result.effectiveUpdatedAt).toBe(300);
    expect(result.memberBookIds).toEqual(["b1", "b2"]);
    expect(result.covers).toEqual(["cover-1", "cover-2"]);
  });

  it("uses a collection's own createdAt/updatedAt directly", () => {
    const collection: Grouping = {
      id: "g2",
      type: "collection",
      name: "Favorites",
      createdAt: 50,
      updatedAt: 75,
    };

    const [result] = buildGroupingsWithMeta(
      [collection],
      new Map([["g2", []]]),
      new Map(),
    );

    expect(result.effectiveCreatedAt).toBe(50);
    expect(result.effectiveUpdatedAt).toBe(75);
    expect(result.memberBookIds).toEqual([]);
    expect(result.covers).toEqual([]);
  });

  it("caps covers at 4 and skips books with no cover", () => {
    const series: Grouping = {
      id: "g1",
      type: "series",
      name: "Foundation",
      createdAt: 1,
      updatedAt: 1,
    };
    const members: GroupingMember[] = [1, 2, 3, 4, 5].map((n) => ({
      groupingId: "g1",
      bookId: `b${n}`,
      order: n,
    }));
    const books = new Map(
      [1, 2, 3, 4, 5].map((n) => [
        `b${n}`,
        makeBook({ id: `b${n}`, coverBg: n === 3 ? undefined : `cover-${n}` }),
      ]),
    );

    const [result] = buildGroupingsWithMeta(
      [series],
      new Map([["g1", members]]),
      books,
    );

    expect(result.covers).toEqual(["cover-1", "cover-2", "cover-4", "cover-5"]);
  });
});

describe("sortGroupings", () => {
  const items = buildGroupingsWithMeta(
    [
      {
        id: "g1",
        type: "series",
        name: "Zed Series",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "g2",
        type: "collection",
        name: "Alpha Shelf",
        createdAt: 3,
        updatedAt: 9,
      },
    ],
    new Map([
      ["g1", [{ groupingId: "g1", bookId: "b1", order: 1 }]],
      ["g2", []],
    ]),
    new Map([["b1", makeBook({ id: "b1", createdAt: 5 })]]),
  );

  it("sorts alphabetically by name", () => {
    const result = sortGroupings(items, "alphabetical");
    expect(result.map((i) => i.grouping.name)).toEqual([
      "Alpha Shelf",
      "Zed Series",
    ]);
  });

  it("sorts by effective createdAt", () => {
    const result = sortGroupings(items, "createdAt");
    expect(result.map((i) => i.grouping.id)).toEqual(["g1", "g2"]);
  });

  it("sorts by effective updatedAt", () => {
    const result = sortGroupings(items, "updatedAt");
    expect(result.map((i) => i.grouping.id)).toEqual(["g2", "g1"]);
  });
});

describe("splitByType", () => {
  it("returns merged, series, and collections lists together", () => {
    const items = buildGroupingsWithMeta(
      [
        { id: "g1", type: "series", name: "A", createdAt: 1, updatedAt: 1 },
        { id: "g2", type: "collection", name: "B", createdAt: 1, updatedAt: 1 },
      ],
      new Map([
        ["g1", []],
        ["g2", []],
      ]),
      new Map(),
    );

    const result = splitByType(items);

    expect(result.merged).toHaveLength(2);
    expect(result.series).toHaveLength(1);
    expect(result.collections).toHaveLength(1);
  });
});
