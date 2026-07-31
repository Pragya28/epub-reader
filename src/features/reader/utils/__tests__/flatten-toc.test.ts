import { describe, expect, it } from "vitest";
import { flattenToc } from "../flatten-toc";
import type { TocItem } from "@/services/epub/epub-types";

function makeItem(
  label: string,
  chapterIndex: number,
  children: TocItem[] = [],
): TocItem {
  return { label, href: `${label}.xhtml`, chapterIndex, children };
}

describe("flattenToc", () => {
  it("returns an empty array for an empty toc", () => {
    expect(flattenToc([], 0)).toEqual([]);
  });

  it("flattens a single-level toc at the given depth", () => {
    const toc = [makeItem("A", 0), makeItem("B", 1)];

    expect(flattenToc(toc, 0)).toEqual([
      { item: toc[0], depth: 0 },
      { item: toc[1], depth: 0 },
    ]);
  });

  it("flattens nested children in document order, incrementing depth", () => {
    const child = makeItem("A.1", 1);
    const parent = makeItem("A", 0, [child]);
    const sibling = makeItem("B", 2);

    const result = flattenToc([parent, sibling], 0);

    expect(result).toEqual([
      { item: parent, depth: 0 },
      { item: child, depth: 1 },
      { item: sibling, depth: 0 },
    ]);
  });

  it("handles multiple levels of nesting", () => {
    const grandchild = makeItem("A.1.1", 2);
    const child = makeItem("A.1", 1, [grandchild]);
    const parent = makeItem("A", 0, [child]);

    const result = flattenToc([parent], 0);

    expect(result.map((r) => r.depth)).toEqual([0, 1, 2]);
  });
});
