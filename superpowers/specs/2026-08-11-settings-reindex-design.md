# Settings — Rebuild Search Index

## Context

Sprint 6 Day 5 wired search-index build/delete into import and delete, plus
lazy backfill on search. What's still missing is a manual escape hatch: if a
book's index is ever corrupted or stale (e.g. after a future tokenizer
change), there's no way to force a fresh rebuild without deleting and
re-importing the book. This adds a "Rebuild Search Index" action to the
Settings screen.

## Decisions

**1. Scope: full wipe + rebuild, all books, no per-book selection.**
For every book in the library: `deleteIndex(bookId)` then
`buildIndex(bookId, file)`. Reuses the exact lifecycle functions from Day 5,
called sequentially (not `Promise.all`) — running N books' worth of JSZip
parsing concurrently is the same resource-contention problem the Day 5 test
suite hit when `importBook` started doing double-parse work; sequential
avoids it and keeps behavior predictable on lower-end devices.

Partial/selected-book rebuild is **not built** — see Non-Goals.

**2. New action: `rebuildSearchIndex()`.**
`src/features/library/actions/rebuild-search-index.ts`:

```ts
export async function rebuildSearchIndex(): Promise<{
  total: number;
  failed: number;
}>;
```

Fetches all books via `getAllBooks()`. For each, wraps
`deleteIndex` + `getBookFile` + `buildIndex` in a try/catch so one bad book
(corrupted file, missing blob) doesn't abort the rest — failures are
counted, not thrown. Returns `{ total, failed }` for the caller to report.

**3. State lives in a new persisted Zustand store, not component state.**
`src/features/library/store/search-maintenance-store.ts`, following the
`persist`-wrapped pattern already used by `preferences-store.ts`:

```ts
interface SearchMaintenanceStore {
  status: "idle" | "running";
  progress: number; // 0-100, estimated
  failedCount: number;
  lastRebuiltAt: number | null; // epoch ms
  startRebuild: () => Promise<void>;
}
```

Only `lastRebuiltAt` is persisted (via `persist`'s `partialize`) —
`status`/`progress`/`failedCount` are session-only and reset to
`idle`/`0`/`0` on page load. This is the deliberate boundary for "survives
backgrounding": `startRebuild()` is a store action, not a component effect,
so it keeps running (interval ticking, `rebuildSearchIndex()` awaiting)
regardless of which screen is mounted — navigating to the reader or
elsewhere in the app doesn't cancel it, since nothing about it is tied to
the Settings screen's component lifecycle. It does **not** survive an
actual page reload or full app close mid-rebuild — that would need a
background-sync API, which is out of scope (see Non-Goals). Since each
book's rebuild is delete-then-build, not merge, re-running after an
interrupted rebuild is always safe — no partial-state corruption to clean
up, just re-click the button.

**4. Progress: estimated, not book-counted.**
`startRebuild()` computes an estimated total duration upfront from
`sum(book.wordCount)` across the library, using a rough, explicitly
unmeasured constant:

```ts
const MS_PER_1000_WORDS = 500; // rough placeholder, not benchmarked
```

A `setInterval` (250ms tick) advances `progress` linearly toward **95%**
over the estimated duration — it deliberately never reaches 100 on its own,
so the bar doesn't appear "done" before the real work finishes if the
estimate runs short. When `rebuildSearchIndex()` actually resolves, the
interval is cleared and `progress` snaps to 100, `status` to `idle`,
`lastRebuiltAt` to `Date.now()`, `failedCount` to the result.

**5. UI: new card in Settings, existing patterns only.**
A new section in `settings-screen.tsx`, styled like the existing
Appearance/Reading cards. Contents:

- A "Rebuild Search Index" `Button` — normal state; while `status ===
"running"`, replaced by the existing `Progress` primitive
  (`src/components/ui/progress.tsx`) plus "Rebuilding…" text, and the
  trigger button disabled.
- On completion, a toast via `notify.success`/`notify.error`
  (`src/components/toast/toast.ts`) — e.g. `"Search index rebuilt"` or
  `"Rebuilt 22 of 23 books — 1 failed"` if `failedCount > 0`.
- A "Last rebuilt: <date>" line, `new Date(lastRebuiltAt).toLocaleString()`
  — no new date-formatting dependency — shown only when `lastRebuiltAt` is
  not `null`.

## Non-Goals

- **Per-book / selected-book rebuild.** Documented here as the natural
  extension if it's ever needed: `rebuildSearchIndex(bookIds?: string[])`
  with `getAllBooks()` filtered to `bookIds` when provided, plus a
  checkbox list of books in the Settings card reusing the same store. Not
  built now — full-library rebuild via one button covers the actual
  use case (a global index problem), and partial selection adds real UI
  (list, multi-select, per-item state) for a need nobody's hit yet.
- **True background survival (page reload / app fully closed mid-rebuild).**
  Would need a Background Sync API / service-worker-driven job queue.
  Out of scope — the store-driven approach already covers "navigate within
  the app while it runs," which is what was actually asked for; surviving
  a hard close is a materially bigger feature for a rarely-used settings
  action.
- **Calibrating `MS_PER_1000_WORDS` against real timings.** Left as a rough
  constant per explicit instruction; revisit if the estimate proves
  noticeably wrong in practice.

## Testing

- `rebuild-search-index.test.ts`: rebuilding a library with N books results
  in fresh, queryable indexes for all of them; a book with a missing/broken
  file is skipped (counted in `failed`) without stopping the others.
- `search-maintenance-store.test.ts`: `startRebuild()` transitions
  `status` idle → running → idle, sets `lastRebuiltAt`, and
  `failedCount` reflects the action's result; `lastRebuiltAt` is the only
  field that survives a store reset (simulating persisted reload).
