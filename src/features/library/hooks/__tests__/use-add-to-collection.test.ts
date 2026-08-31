import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAddToCollection } from "../use-add-to-collection";

vi.mock("@/services/storage/groupings", () => ({
  getMembersForBook: vi.fn(async () => []),
  getMembersForGrouping: vi.fn(async () => []),
  listGroupings: vi.fn(async () => [
    { id: "g1", type: "collection", name: "Favorites", createdAt: 1 },
  ]),
}));

const addBookToCollection = vi.fn();
const createCollection = vi.fn();
const removeBookFromCollection = vi.fn();

vi.mock("../../actions/collections", () => ({
  addBookToCollection: (...args: unknown[]) => addBookToCollection(...args),
  createCollection: (...args: unknown[]) => createCollection(...args),
  removeBookFromCollection: (...args: unknown[]) =>
    removeBookFromCollection(...args),
}));

vi.mock("@/components/toast/toast", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe("useAddToCollection error messaging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toasts an error when toggle fails", async () => {
    const { notify } = await import("@/components/toast/toast");
    addBookToCollection.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useAddToCollection("b1", true));
    await waitFor(() => expect(result.current.collections).toHaveLength(1));

    await result.current.toggle("g1");

    expect(notify.error).toHaveBeenCalled();
  });

  it("toasts an error when createAndAdd fails", async () => {
    const { notify } = await import("@/components/toast/toast");
    createCollection.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useAddToCollection("b1", true));
    await waitFor(() => expect(result.current.collections).toHaveLength(1));

    await result.current.createAndAdd("New Shelf");

    expect(notify.error).toHaveBeenCalled();
  });
});
