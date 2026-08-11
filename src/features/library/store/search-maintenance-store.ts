import { create } from "zustand";
import { persist } from "zustand/middleware";
import { rebuildSearchIndex } from "../actions/rebuild-search-index";
import { getAllBooks } from "@/services/storage/book-repository";

// Rough, explicitly unmeasured estimate — no calibration benchmark was
// run for this. Revisit only if it proves noticeably wrong in practice.
const MS_PER_1000_WORDS = 500;
const PROGRESS_TICK_MS = 250;
const MAX_ESTIMATED_PROGRESS = 95;

interface SearchMaintenanceStore {
  status: "idle" | "running";
  progress: number;
  failedCount: number;
  lastRebuiltAt: number | null;
  startRebuild: () => Promise<void>;
}

export const searchMaintenanceStore = create<SearchMaintenanceStore>()(
  persist(
    (set, get) => ({
      status: "idle",
      progress: 0,
      failedCount: 0,
      lastRebuiltAt: null,

      startRebuild: async () => {
        if (get().status === "running") return;

        set({ status: "running", progress: 0, failedCount: 0 });

        const books = await getAllBooks();
        const totalWords = books.reduce(
          (sum, book) => sum + (book.wordCount ?? 0),
          0,
        );
        const estimatedMs = Math.max(
          (totalWords / 1000) * MS_PER_1000_WORDS,
          1,
        );

        const startedAt = Date.now();
        const interval = setInterval(() => {
          const elapsed = Date.now() - startedAt;
          const estimatedProgress = Math.min(
            (elapsed / estimatedMs) * 100,
            MAX_ESTIMATED_PROGRESS,
          );
          set((state) =>
            state.status === "running" ? { progress: estimatedProgress } : {},
          );
        }, PROGRESS_TICK_MS);

        try {
          const result = await rebuildSearchIndex();
          set({
            status: "idle",
            progress: 100,
            failedCount: result.failed,
            lastRebuiltAt: Date.now(),
          });
        } finally {
          clearInterval(interval);
        }
      },
    }),
    {
      name: "librune-search-maintenance",
      partialize: (state) => ({ lastRebuiltAt: state.lastRebuiltAt }),
    },
  ),
);
