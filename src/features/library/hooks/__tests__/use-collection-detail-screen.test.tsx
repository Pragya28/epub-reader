import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useCollectionDetailScreen } from "../use-collection-detail-screen";
import { libraryStore } from "../../store/library-store";
import { ROUTES } from "@/utils/routes";
import type { StoredBook } from "@/services/storage/storage-types";

vi.mock("@/services/storage/groupings", () => ({
  getGrouping: vi.fn(async (id: string) =>
    id === "g1"
      ? {
          id: "g1",
          type: "collection",
          name: "Favorites",
          createdAt: 1,
          updatedAt: 1,
        }
      : id === "g2"
        ? {
            id: "g2",
            type: "series",
            name: "Foundation Series",
            createdAt: 1,
            updatedAt: 1,
          }
        : undefined,
  ),
  getMembersForGrouping: vi.fn(async () => [
    { groupingId: "g1", bookId: "b2", order: 1 },
    { groupingId: "g1", bookId: "b1", order: 0 },
  ]),
  isCollection: vi.fn((g: { type: string }) => g.type === "collection"),
}));

const renameCollection = vi.fn();
const deleteCollection = vi.fn();
const removeBookFromCollection = vi.fn();

vi.mock("../../actions/collections", () => ({
  renameCollection: (...args: unknown[]) => renameCollection(...args),
  deleteCollection: (...args: unknown[]) => deleteCollection(...args),
  removeBookFromCollection: (...args: unknown[]) =>
    removeBookFromCollection(...args),
}));

function renderAt(groupingId: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/library/collection/${groupingId}`]}>
      <Routes>
        <Route path={ROUTES.LIBRARY_COLLECTION} element={<>{children}</>} />
      </Routes>
    </MemoryRouter>
  );
  return renderHook(() => useCollectionDetailScreen(), { wrapper });
}

describe("useCollectionDetailScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("orders books by GroupingMember.order (add order)", async () => {
    const { result } = renderAt("g1");

    await waitFor(() => expect(result.current.groupingName).toBe("Favorites"));
    expect(result.current.books.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(result.current.redirectToShelves).toBe(false);
  });

  it("flags redirectToShelves for a series-type grouping id", async () => {
    const { result } = renderAt("g2");

    await waitFor(() => expect(result.current.redirectToShelves).toBe(true));
  });

  it("flags redirectToShelves for an unresolvable grouping id", async () => {
    const { result } = renderAt("missing");

    await waitFor(() => expect(result.current.redirectToShelves).toBe(true));
  });

  it("renames via the action layer", async () => {
    const { result } = renderAt("g1");
    await waitFor(() => expect(result.current.groupingName).toBe("Favorites"));

    await result.current.rename("Comfort Reads");

    expect(renameCollection).toHaveBeenCalledWith("g1", "Comfort Reads");
  });

  it("removes a book via the action layer", async () => {
    const { result } = renderAt("g1");
    await waitFor(() => expect(result.current.groupingName).toBe("Favorites"));

    await result.current.removeBook("b1");

    expect(removeBookFromCollection).toHaveBeenCalledWith("g1", "b1");
  });
});
