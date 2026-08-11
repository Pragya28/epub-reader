import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as bookRepository from "@/services/storage/book-repository";
import * as rebuildSearchIndexModule from "../../actions/rebuild-search-index";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { resetLibraryStore } from "@/tests/utils/reset-store";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { importBook } from "../../actions/import-book";
import { searchMaintenanceStore } from "../search-maintenance-store";
import type { StoredBook } from "@/services/storage/storage-types";

describe("searchMaintenanceStore", () => {
  beforeEach(async () => {
    await resetTestDb();
    resetLibraryStore();
    searchMaintenanceStore.setState({
      status: "idle",
      progress: 0,
      failedCount: 0,
      lastRebuiltAt: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("transitions idle -> running -> idle and records lastRebuiltAt", async () => {
    const file = await loadFixture("valid-book.epub");
    const { id } = await importBook(file);

    // fake-indexeddb doesn't structured-clone File/Blob objects correctly
    // through Dexie's bookFiles table in this test environment — see
    // rebuild-search-index.test.ts for the full explanation. Stub
    // getBookFile to hand back the original in-memory file so the rebuild
    // this store triggers actually succeeds (failedCount: 0), matching
    // real-browser behavior.
    vi.spyOn(bookRepository, "getBookFile").mockImplementation(
      async (bookId: string) => (bookId === id ? { bookId, file } : undefined),
    );

    expect(searchMaintenanceStore.getState().status).toBe("idle");

    const rebuildPromise = searchMaintenanceStore.getState().startRebuild();
    expect(searchMaintenanceStore.getState().status).toBe("running");

    await rebuildPromise;

    const state = searchMaintenanceStore.getState();
    expect(state.status).toBe("idle");
    expect(state.progress).toBe(100);
    expect(state.failedCount).toBe(0);
    expect(state.lastRebuiltAt).not.toBeNull();
  }, 30000);

  it("advances progress toward 95% while running, via an interval", async () => {
    // Fully mocked — no real Dexie/JSZip work, so fake timers (which only
    // control setInterval/Date, not library-internal async I/O) behave
    // predictably. A large word count gives the interval room to tick a
    // few times before the (mocked, deferred) rebuild resolves.
    vi.spyOn(bookRepository, "getAllBooks").mockResolvedValue([
      { wordCount: 100000 } as StoredBook,
    ]);

    let resolveRebuild!: (value: { total: number; failed: number }) => void;
    const deferredRebuild = new Promise<{ total: number; failed: number }>(
      (resolve) => {
        resolveRebuild = resolve;
      },
    );
    vi.spyOn(rebuildSearchIndexModule, "rebuildSearchIndex").mockReturnValue(
      deferredRebuild,
    );

    vi.useFakeTimers();

    const rebuildPromise = searchMaintenanceStore.getState().startRebuild();

    await vi.advanceTimersByTimeAsync(250);
    const midProgress = searchMaintenanceStore.getState().progress;
    expect(midProgress).toBeGreaterThan(0);
    expect(midProgress).toBeLessThanOrEqual(95);

    resolveRebuild({ total: 1, failed: 0 });
    vi.useRealTimers();
    await rebuildPromise;

    expect(searchMaintenanceStore.getState().progress).toBe(100);
  }, 30000);
});
