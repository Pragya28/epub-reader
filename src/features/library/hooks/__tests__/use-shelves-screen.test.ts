import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useShelvesScreen } from "../use-shelves-screen";
import { libraryStore } from "../../store/library-store";
import { shelvesStore } from "../../store/shelves-store";
import type { StoredBook } from "@/services/storage/storage-types";

const book1: StoredBook = {
  id: "b1",
  title: "Foundation",
  createdAt: 100,
  fileHash: "h1",
  coverBg: "cover-1",
} as StoredBook;
const book2: StoredBook = {
  id: "b2",
  title: "Foundation and Empire",
  createdAt: 200,
  fileHash: "h2",
  coverBg: "cover-2",
} as StoredBook;

vi.mock("@/services/storage/groupings", () => ({
  ensureSeriesGroupings: vi.fn(async () => {}),
  listGroupings: vi.fn(async () => [
    {
      id: "g1",
      type: "series",
      name: "Foundation Series",
      createdAt: 1,
      updatedAt: 1,
    },
  ]),
  getMembersForGrouping: vi.fn(async (groupingId: string) =>
    groupingId === "g1"
      ? [
          { groupingId: "g1", bookId: "b1", order: 1 },
          { groupingId: "g1", bookId: "b2", order: 2 },
        ]
      : [],
  ),
}));

vi.mock("@/components/toast/toast", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe("useShelvesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    libraryStore.setState({
      books: [book1, book2],
      isLoading: false,
      error: null,
    });
    shelvesStore.setState({ sortBy: "alphabetical", viewMode: "merged" });
  });

  it("loads groupings with member covers, ordered by GroupingMember.order", async () => {
    const { result } = renderHook(() => useShelvesScreen());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.merged).toHaveLength(1);
    expect(result.current.merged[0].coverSlots).toEqual([
      { bookId: "b1", coverUrl: "cover-1" },
      { bookId: "b2", coverUrl: "cover-2" },
    ]);
    expect(result.current.isEmpty).toBe(false);
  });

  it("reports empty when there are no groupings", async () => {
    const groupings = await import("@/services/storage/groupings");
    vi.mocked(groupings.listGroupings).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useShelvesScreen());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEmpty).toBe(true);
  });

  it("switches view mode via shelvesStore", async () => {
    const { result } = renderHook(() => useShelvesScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setViewMode("grouped"));

    await waitFor(() => expect(result.current.viewMode).toBe("grouped"));
    expect(result.current.series).toHaveLength(1);
    expect(result.current.collections).toHaveLength(0);
  });

  it("toasts an error and clears loading when listGroupings fails", async () => {
    const groupings = await import("@/services/storage/groupings");
    const { notify } = await import("@/components/toast/toast");
    vi.mocked(groupings.listGroupings).mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useShelvesScreen());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(notify.error).toHaveBeenCalled();
  });
});
