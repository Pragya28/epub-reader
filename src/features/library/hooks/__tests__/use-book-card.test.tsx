import { renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useBookCard } from "../use-book-card";
import { libraryStore } from "../../store/library-store";
import type { BookWithProgress } from "../../types/library.types";
import type { StoredBook } from "@/services/storage/storage-types";

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

function makeBook(overrides: Partial<BookWithProgress> = {}): BookWithProgress {
  return {
    id: "b1",
    title: "Foundation",
    createdAt: 0,
    fileHash: "h1",
    status: "unread",
    seriesName: "Foundation Series",
    seriesGroupingId: "g1",
    ...overrides,
  };
}

describe("useBookCard series link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hasSeriesLink is false when fewer than 2 books share the series", () => {
    libraryStore.setState({
      books: [makeBook()] as StoredBook[],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useBookCard(makeBook()), { wrapper });

    expect(result.current.hasSeriesLink).toBe(false);
  });

  it("hasSeriesLink is true when 2+ books share the series", () => {
    libraryStore.setState({
      books: [
        makeBook({ id: "b1" }),
        makeBook({ id: "b2", title: "Foundation and Empire" }),
      ] as StoredBook[],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useBookCard(makeBook()), { wrapper });

    expect(result.current.hasSeriesLink).toBe(true);
    expect(
      result.current.menuItems.some((item) => item.id === "view-series"),
    ).toBe(true);
  });

  it("hasSeriesLink is false when the book has no seriesName", () => {
    libraryStore.setState({
      books: [
        makeBook({
          id: "b1",
          seriesName: undefined,
          seriesGroupingId: undefined,
        }),
        makeBook({
          id: "b2",
          seriesName: undefined,
          seriesGroupingId: undefined,
        }),
      ] as StoredBook[],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(
      () =>
        useBookCard(
          makeBook({ seriesName: undefined, seriesGroupingId: undefined }),
        ),
      { wrapper },
    );

    expect(result.current.hasSeriesLink).toBe(false);
  });
});
