# Settings Rebuild Search Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Rebuild Search Index" action to the Settings screen that wipes and rebuilds the search index for every book, runs independently of the Settings screen's mounted state (survives navigating elsewhere in the app), shows an estimated progress bar, and records/displays a last-rebuilt date.

**Architecture:** A new action function (`rebuildSearchIndex`) does the actual per-book delete+rebuild work sequentially, tolerating individual book failures. A new persisted Zustand store (`search-maintenance-store.ts`) owns the orchestration — its `startRebuild()` action computes an estimated duration, drives a `setInterval`-based progress value, and calls `rebuildSearchIndex()` — so the operation isn't tied to any component's lifecycle. The Settings screen only reads store state and calls `startRebuild()`.

**Tech Stack:** TypeScript, Zustand (`persist` middleware), Dexie (IndexedDB), Vitest (`vi.useFakeTimers`), existing `Progress`/`Button` UI primitives, `sonner`-backed `notify` toast helper.

## Global Constraints

- Package manager is pnpm — don't use npm/yarn.
- `store` in a filename means a Zustand store only.
- Don't re-export one module's functions through another for convenience — import each function directly from its defining module.
- Tests are colocated in `__tests__/` next to the code they cover.
- Use real EPUB fixtures from `src/tests/fixtures/*.epub` via `loadFixture()` — don't hand-construct EPUB blobs.
- `resetTestDb()` (from `src/tests/utils/reset-test-db.ts`) must run in `beforeEach` for any test touching Dexie state.
- Within a flex/grid container, space children with `gap`, not per-child margins.
- No new date-formatting dependency — use `Date.prototype.toLocaleString()`.
- The estimate constant (`MS_PER_1000_WORDS = 500`) is an explicit unmeasured placeholder, not a bug to "fix" during this plan.

---

### Task 1: `rebuildSearchIndex()` action

**Files:**

- Create: `src/features/library/actions/rebuild-search-index.ts`
- Test: `src/features/library/actions/__tests__/rebuild-search-index.test.ts`

**Interfaces:**

- Consumes: `getAllBooks(): Promise<StoredBook[]>` and `getBookFile(bookId: string): Promise<StoredBookFile | undefined>` from `@/services/storage/book-repository`; `deleteIndex(bookId: string): Promise<void>` from `@/services/search/search-index`; `buildIndex(bookId: string, file: Blob): Promise<void>` from `@/services/search/search-service`.
- Produces: `rebuildSearchIndex(): Promise<{ total: number; failed: number }>` — exported from `@/features/library/actions/rebuild-search-index`, consumed by Task 2's store.

- [ ] **Step 1: Write the failing test**

Create `src/features/library/actions/__tests__/rebuild-search-index.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { hasIndex, findMatches } from "@/services/search/search-index";
import { getAllBooks } from "@/services/storage/book-repository";
import { importBook } from "../import-book";
import { rebuildSearchIndex } from "../rebuild-search-index";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { resetLibraryStore } from "@/tests/utils/reset-store";

describe("rebuildSearchIndex", () => {
  beforeEach(async () => {
    await resetTestDb();
    resetLibraryStore();
  });

  it("rebuilds the index for every book in the library", async () => {
    const first = await loadFixture("valid-book.epub");
    const second = await loadFixture("valid-book-2.epub");
    await importBook(first);
    await importBook(second);

    const books = await getAllBooks();
    expect(books).toHaveLength(2);

    const result = await rebuildSearchIndex();

    expect(result).toEqual({ total: 2, failed: 0 });
    for (const book of books) {
      expect(await hasIndex(book.id)).toBe(true);
    }
  });

  it("counts a book with a missing file blob as failed without stopping the rest", async () => {
    const file = await loadFixture("valid-book.epub");
    await importBook(file);
    const [book] = await getAllBooks();

    // Simulate a corrupted/missing file for this book: delete its stored
    // file blob directly via Dexie, leaving the book row and index intact.
    const { db } = await import("@/services/storage/db");
    await db.bookFiles.delete(book.id);

    const result = await rebuildSearchIndex();

    expect(result).toEqual({ total: 1, failed: 1 });
  });

  it("removes stale index entries a book no longer contains", async () => {
    const file = await loadFixture("valid-book.epub");
    await importBook(file);
    const [book] = await getAllBooks();

    // Inject a bogus entry that a real parse of this book would never
    // produce, simulating a stale/corrupted index row.
    const { putIndexEntries } = await import("@/services/search/search-index");
    await putIndexEntries([
      { word: "totallyfakeword", bookId: book.id, chapter: 0 },
    ]);

    await rebuildSearchIndex();

    const stale = await findMatches("totallyfakeword", book.id);
    expect(stale).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/features/library/actions/__tests__/rebuild-search-index.test.ts`
Expected: FAIL — `../rebuild-search-index` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/library/actions/rebuild-search-index.ts`:

```ts
import { deleteIndex } from "@/services/search/search-index";
import { buildIndex } from "@/services/search/search-service";
import { getAllBooks, getBookFile } from "@/services/storage/book-repository";

/**
 * Wipes and rebuilds the search index for every book, one at a time.
 * Sequential (not Promise.all) — running every book's JSZip parse
 * concurrently is real resource contention on lower-end devices. A single
 * book's failure (missing/corrupted file) is counted, not thrown, so it
 * doesn't block the rest of the library from getting a fresh index.
 */
export async function rebuildSearchIndex(): Promise<{
  total: number;
  failed: number;
}> {
  const books = await getAllBooks();
  let failed = 0;

  for (const book of books) {
    try {
      await deleteIndex(book.id);
      const stored = await getBookFile(book.id);
      if (!stored) {
        failed += 1;
        continue;
      }
      await buildIndex(book.id, stored.file);
    } catch {
      failed += 1;
    }
  }

  return { total: books.length, failed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/features/library/actions/__tests__/rebuild-search-index.test.ts`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/library/actions/rebuild-search-index.ts src/features/library/actions/__tests__/rebuild-search-index.test.ts
git commit -m "feat(search): add rebuildSearchIndex action for full-library reindex"
```

---

### Task 2: `search-maintenance-store` with estimated-progress orchestration

**Files:**

- Create: `src/features/library/store/search-maintenance-store.ts`
- Test: `src/features/library/store/__tests__/search-maintenance-store.test.ts`

**Interfaces:**

- Consumes: `rebuildSearchIndex(): Promise<{ total: number; failed: number }>` from `../actions/rebuild-search-index`; `getAllBooks(): Promise<StoredBook[]>` from `@/services/storage/book-repository` (`StoredBook.wordCount?: number`, per `src/services/storage/storage-types.ts`).
- Produces: `searchMaintenanceStore` — a Zustand store hook exported from `@/features/library/store/search-maintenance-store`, with shape:

  ```ts
  interface SearchMaintenanceStore {
    status: "idle" | "running";
    progress: number; // 0-100
    failedCount: number;
    lastRebuiltAt: number | null;
    startRebuild: () => Promise<void>;
  }
  ```

  Consumed by Task 3's Settings UI.

- [ ] **Step 1: Write the failing test**

Create `src/features/library/store/__tests__/search-maintenance-store.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { resetLibraryStore } from "@/tests/utils/reset-store";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { importBook } from "../../actions/import-book";
import { searchMaintenanceStore } from "../search-maintenance-store";

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
  });

  it("transitions idle -> running -> idle and records lastRebuiltAt", async () => {
    const file = await loadFixture("valid-book.epub");
    await importBook(file);

    expect(searchMaintenanceStore.getState().status).toBe("idle");

    const rebuildPromise = searchMaintenanceStore.getState().startRebuild();
    expect(searchMaintenanceStore.getState().status).toBe("running");

    await rebuildPromise;

    const state = searchMaintenanceStore.getState();
    expect(state.status).toBe("idle");
    expect(state.progress).toBe(100);
    expect(state.failedCount).toBe(0);
    expect(state.lastRebuiltAt).not.toBeNull();
  });

  it("advances progress toward 95% while running, via an interval", async () => {
    vi.useFakeTimers();
    const file = await loadFixture("valid-book.epub");
    await importBook(file);

    const rebuildPromise = searchMaintenanceStore.getState().startRebuild();

    await vi.advanceTimersByTimeAsync(250);
    const midProgress = searchMaintenanceStore.getState().progress;
    expect(midProgress).toBeGreaterThan(0);
    expect(midProgress).toBeLessThanOrEqual(95);

    vi.useRealTimers();
    await rebuildPromise;

    expect(searchMaintenanceStore.getState().progress).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/features/library/store/__tests__/search-maintenance-store.test.ts`
Expected: FAIL — `../search-maintenance-store` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/library/store/search-maintenance-store.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/features/library/store/__tests__/search-maintenance-store.test.ts`
Expected: PASS, both tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/library/store/search-maintenance-store.ts src/features/library/store/__tests__/search-maintenance-store.test.ts
git commit -m "feat(search): add search-maintenance-store for rebuild orchestration"
```

---

### Task 3: Settings UI — "Search Index" card

**Files:**

- Modify: `src/app/screens/settings-screen.tsx`
- Modify: `src/app/screens/__tests__/settings-screen.test.tsx`

**Interfaces:**

- Consumes: `searchMaintenanceStore` from `@/features/library/store/search-maintenance-store` (shape from Task 2); `Progress`, `ProgressTrack`, `ProgressIndicator` from `@/components/ui/progress`; `Button` from `@/components/ui/button`; `notify` from `@/components/toast/toast`; `DatabaseZap` icon from `lucide-react` (matches the existing `Sun`/`CaseSensitive` section-icon convention).
- Produces: nothing new consumed by later tasks — this is the final task.

- [ ] **Step 1: Write the failing test**

Read the existing test file first to match its setup pattern:

```bash
cat src/app/screens/__tests__/settings-screen.test.tsx
```

Add a new test to that file (adjust the render/setup boilerplate to match whatever pattern the existing tests already use — likely a `render(<SettingsScreen />)` wrapped in the app's router/provider setup):

```ts
it("triggers a search index rebuild and shows a completion toast", async () => {
  const user = userEvent.setup();
  render(<SettingsScreen />);

  const rebuildButton = screen.getByRole("button", {
    name: /rebuild search index/i,
  });
  await user.click(rebuildButton);

  await waitFor(() => {
    expect(screen.getByText(/rebuilding/i)).toBeInTheDocument();
  });

  await waitFor(
    () => {
      expect(screen.getByText(/last rebuilt/i)).toBeInTheDocument();
    },
    { timeout: 10000 },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/app/screens/__tests__/settings-screen.test.tsx`
Expected: FAIL — no "Rebuild Search Index" button exists yet.

- [ ] **Step 3: Write minimal implementation**

In `src/app/screens/settings-screen.tsx`, add imports:

```ts
import { ChevronLeft, Sun, CaseSensitive, DatabaseZap } from "lucide-react";
```

```ts
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from "@/components/ui/progress";
import { notify } from "@/components/toast/toast";
import { searchMaintenanceStore } from "@/features/library/store/search-maintenance-store";
```

Inside `SettingsScreen`, alongside the existing `preferencesStore()` destructure, add:

```ts
const { status, progress, failedCount, lastRebuiltAt, startRebuild } =
  searchMaintenanceStore();

const handleRebuild = async () => {
  await startRebuild();
  const { failedCount: failed } = searchMaintenanceStore.getState();
  if (failed > 0) {
    notify.error(`Rebuilt search index — ${failed} book(s) failed`);
  } else {
    notify.success("Search index rebuilt");
  }
};
```

After the closing `</section>` of the "Reading" section (before the closing `</div>` of the `flex flex-col gap-6` wrapper), add a new section:

```tsx
<section className="flex flex-col gap-6 rounded-sm border border-border bg-card p-6">
  <div className="flex items-center gap-2">
    <DatabaseZap className="size-4 text-muted-foreground" strokeWidth={1.5} />
    <h2 className="metadata">Search Index</h2>
  </div>

  <div className="flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-ui font-semibold text-foreground">
          Rebuild Search Index
        </span>
        <span className="text-ui-sm text-muted-foreground">
          {lastRebuiltAt
            ? `Last rebuilt: ${new Date(lastRebuiltAt).toLocaleString()}`
            : "Never rebuilt"}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={status === "running"}
        onClick={handleRebuild}
      >
        {status === "running" ? "Rebuilding…" : "Rebuild Search Index"}
      </Button>
    </div>

    {status === "running" && (
      <Progress value={progress}>
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>
    )}
  </div>
</section>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/app/screens/__tests__/settings-screen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `pnpm test:run`
Expected: all tests pass, including everything from Tasks 1–3.

- [ ] **Step 6: Manual verification in the browser**

Start the dev server (`pnpm dev`), open Settings with at least one book imported, click "Rebuild Search Index", and confirm: the button disables and shows "Rebuilding…", a progress bar appears and advances, a toast appears on completion, and "Last rebuilt: <date>" updates. Reload the page and confirm the "Last rebuilt" date persists (localStorage), while the button/progress reset to idle.

- [ ] **Step 7: Commit**

```bash
git add src/app/screens/settings-screen.tsx src/app/screens/__tests__/settings-screen.test.tsx
git commit -m "feat(settings): add rebuild search index UI card"
```

---

## Self-Review Notes

- **Spec coverage:** decision 1 (full wipe, all books) → Task 1; decision 2 (`rebuildSearchIndex` signature) → Task 1; decision 3 (persisted store, survives navigation) → Task 2; decision 4 (estimated progress, `MS_PER_1000_WORDS`, 95% cap) → Task 2; decision 5 (UI card, button/progress/toast/last-rebuilt) → Task 3. Non-goals (partial rebuild, true background survival, calibration) are intentionally not tasked — confirmed no task references them.
- **Placeholder scan:** none — every step has runnable code. Task 3's Step 1 references reading the existing test file first because its render/provider boilerplate isn't known ahead of time; the assertions themselves are fully written out, only the render harness needs matching to the file's existing pattern.
- **Type consistency:** `rebuildSearchIndex(): Promise<{ total: number; failed: number }>` used identically in Task 1 and consumed in Task 2. `SearchMaintenanceStore` shape (`status`, `progress`, `failedCount`, `lastRebuiltAt`, `startRebuild`) matches between Task 2's definition and Task 3's destructure.
