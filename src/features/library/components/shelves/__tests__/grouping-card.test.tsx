import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { GroupingCard } from "../grouping-card";
import type {
  GroupingCoverSlot,
  GroupingWithMeta,
} from "../../../utils/sort-groupings";

function makeItem(
  coverSlots: GroupingCoverSlot[],
  type: "series" | "collection" = "series",
): GroupingWithMeta {
  return {
    grouping: {
      id: "g1",
      type,
      name: "Foundation",
      createdAt: 1,
      updatedAt: 1,
    },
    memberBookIds: coverSlots.map((slot) => slot.bookId),
    effectiveCreatedAt: 1,
    effectiveUpdatedAt: 1,
    coverSlots,
  };
}

const withCover = (n: number): GroupingCoverSlot => ({
  bookId: `b${n}`,
  title: `Book ${n}`,
  coverUrl: `cover-${n}`,
});
const noCover = (n: number): GroupingCoverSlot => ({
  bookId: `b${n}`,
  title: `Book ${n}`,
});

function renderCard(
  slots: GroupingCoverSlot[],
  type?: "series" | "collection",
) {
  const { container } = render(
    <MemoryRouter>
      <GroupingCard item={makeItem(slots, type)} />
    </MemoryRouter>,
  );
  return container.querySelector("[data-layout]") as HTMLElement;
}

describe("GroupingCard layout", () => {
  it("shows an empty tile for a group with no books", () => {
    const art = renderCard([], "collection");
    expect(art.dataset.layout).toBe("empty");
    expect(art.querySelectorAll("img")).toHaveLength(0);
  });

  it("draws a generated cover for a single coverless book, same pattern as a real cover", () => {
    const art = renderCard([noCover(1)]);
    expect(art.dataset.layout).toBe("single");
    expect(art.querySelectorAll("img")).toHaveLength(0);
    expect(art.textContent).toContain("Book 1");
  });

  it("draws two generated covers side by side for two coverless books", () => {
    const art = renderCard([noCover(1), noCover(2)]);
    expect(art.dataset.layout).toBe("pair");
    expect(art.textContent).toContain("Book 1");
    expect(art.textContent).toContain("Book 2");
  });

  it("draws one spine per book (up to 5) when 3+ books have no cover", () => {
    const art = renderCard([1, 2, 3, 4, 5, 6].map(noCover));
    expect(art.dataset.layout).toBe("spines");
    expect(art.querySelectorAll("img")).toHaveLength(0);
    expect(art.textContent).toContain("Book 1");
    expect(art.textContent).toContain("Book 5");
    expect(art.textContent).not.toContain("Book 6");
  });

  it("shows the lone real cover full-size, ignoring coverless books", () => {
    const art = renderCard([withCover(1), noCover(2), noCover(3)]);
    expect(art.dataset.layout).toBe("single");
    expect(art.querySelectorAll("img")).toHaveLength(1);
  });

  it("shows two tiles side by side for two real covers and no more books", () => {
    const art = renderCard([withCover(1), withCover(2)]);
    expect(art.dataset.layout).toBe("pair");
    expect(art.querySelectorAll("img")).toHaveLength(2);
  });

  it("uses the mosaic for 2+ real covers among 3+ books, with generated covers for the rest", () => {
    const art = renderCard([withCover(1), withCover(2), noCover(3)]);
    expect(art.dataset.layout).toBe("mosaic");
    expect(art.querySelectorAll("img")).toHaveLength(2);
    // The coverless third book is drawn (its initial), not left blank.
    expect(art.textContent).toContain("B");
  });

  it("sizes spine widths from word count, within bounds, with a fallback", () => {
    const words = [3_000, 100_000, 900_000, undefined];
    const art = renderCard(
      words.map((wordCount, i) => ({ ...noCover(i + 1), wordCount })),
    );
    expect(art.dataset.layout).toBe("spines");
    const widths = [
      ...art.querySelectorAll<HTMLElement>("[style*='width']"),
    ].map((el) => Number.parseInt(el.style.width, 10));
    expect(widths).toEqual([16, 22, 34, 24]);
  });
});
