import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useBookCard } from "../use-book-card";
import { libraryStore } from "../../store/library-store";
import type { BookWithProgress } from "../../types/library.types";
import type { StoredBook } from "@/services/storage/storage-types";
import { markBookFinished } from "../../actions/mark-book-status";
import { notify } from "@/components/toast/toast";

vi.mock("../../actions/mark-book-status", () => ({
  markBookFinished: vi.fn(),
  markBookUnread: vi.fn(),
  startBookAtBeginning: vi.fn(),
}));
vi.mock("@/components/toast/toast", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

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

describe("useBookCard status action error messaging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    libraryStore.setState({ books: [], isLoading: false, error: null });
  });

  it("toasts an error when marking a book finished fails", async () => {
    vi.mocked(markBookFinished).mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useBookCard(makeBook()), { wrapper });
    const markFinishedItem = result.current.menuItems.find(
      (item) => item.type === "item" && item.id === "mark-finished",
    );
    if (markFinishedItem?.type !== "item") throw new Error("item not found");
    markFinishedItem.onClick();

    await waitFor(() => expect(notify.error).toHaveBeenCalled());
  });
});
