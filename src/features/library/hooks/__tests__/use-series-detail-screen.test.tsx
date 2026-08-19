import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useSeriesDetailScreen } from "../use-series-detail-screen";
import { libraryStore } from "../../store/library-store";
import { ROUTES } from "@/utils/routes";
import type { StoredBook } from "@/services/storage/storage-types";

vi.mock("@/services/storage/groupings", () => ({
  getGrouping: vi.fn(async (id: string) =>
    id === "g1"
      ? {
          id: "g1",
          type: "series",
          name: "Foundation Series",
          createdAt: 1,
          updatedAt: 1,
        }
      : id === "g2"
        ? {
            id: "g2",
            type: "collection",
            name: "Favorites",
            createdAt: 1,
            updatedAt: 1,
          }
        : undefined,
  ),
  getMembersForGrouping: vi.fn(async () => [
    { groupingId: "g1", bookId: "b2", order: 2 },
    { groupingId: "g1", bookId: "b1", order: 1 },
  ]),
  isCollection: vi.fn((g: { type: string }) => g.type === "collection"),
}));

function renderAt(groupingId: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/library/series/${groupingId}`]}>
      <Routes>
        <Route path={ROUTES.LIBRARY_SERIES} element={<>{children}</>} />
      </Routes>
    </MemoryRouter>
  );
  return renderHook(() => useSeriesDetailScreen(), { wrapper });
}

describe("useSeriesDetailScreen", () => {
  beforeEach(() => {
    libraryStore.setState({
      books: [
        {
          id: "b1",
          title: "Foundation",
          createdAt: 1,
          fileHash: "h1",
        } as StoredBook,
        {
          id: "b2",
          title: "Foundation and Empire",
          createdAt: 2,
          fileHash: "h2",
        } as StoredBook,
      ],
      isLoading: false,
      error: null,
    });
  });

  it("orders books by GroupingMember.order regardless of import order", async () => {
    const { result } = renderAt("g1");

    await waitFor(() =>
      expect(result.current.groupingName).toBe("Foundation Series"),
    );
    expect(result.current.books.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(result.current.redirectToShelves).toBe(false);
  });

  it("defaults hideFinished to false for the series screen", async () => {
    const { result } = renderAt("g1");
    await waitFor(() =>
      expect(result.current.groupingName).toBe("Foundation Series"),
    );

    expect(result.current.filters.hideFinished).toBe(false);
  });

  it("flags redirectToShelves for a collection-type grouping id", async () => {
    const { result } = renderAt("g2");

    await waitFor(() => expect(result.current.redirectToShelves).toBe(true));
  });

  it("flags redirectToShelves for an unresolvable grouping id", async () => {
    const { result } = renderAt("missing");

    await waitFor(() => expect(result.current.redirectToShelves).toBe(true));
  });
});
