# Close the Sprint 8B Carried-Forward Defects List

## Context

`central-docs/06 - Implementation/Sprint - 08B – Implementation Status.md` ends with a
"Carried Forward" section: real defects found during the post-sprint hardening review
(commit `5eefde9`, unpushed) that were verified but deliberately left unfixed. The user
wants that list closed out. I re-verified every item against current source before
planning — two items turned out to already be fixed (stale-docs, dormant putIndexEntries
guard) and are dropped below; everything else still reproduces as described.

This is a defect-closure pass, not new feature work — ponytail applies: smallest real fix
per item, no speculative generalization. Per `CLAUDE.md`, execute one task at a time —
implement, verify, commit — and stop for go-ahead before the next, in the order below.
Tiers are ordered cheapest/safest first.

## Already fixed (no action)

- **Stale docs (EPUB3 `belongs-to-collection`)** — both `CLAUDE.md` and
  `docs/tasks/development-phase/SPRINT-07-TASKS.md` already document the EPUB3 fallback correctly. Nothing to do.
- **`putIndexEntries` empty-list guard** — `search-index.ts:12` already returns early
  when `entries.length === 0`; the carried-forward note was describing existing (correct)
  behavior, not a bug.

## Tier 1 — Mechanical fixes (one-liners to small, no design decisions)

1. **`ensureSeriesGroupings` swallows errors silently** — [groupings.ts:197](src/services/storage/groupings.ts:197):
   add `logger.error` in the catch, matching the pattern already used in
   `ensureIndexesForBooks` (search-service.ts:106).
2. **Cover cache never invalidated on save** — [book-repository.ts:17](src/services/storage/book-repository.ts:17)
   `saveBookCover` doesn't call `revokeCoverUrl`, so a re-imported/updated cover keeps
   serving the old blob URL (`cacheCoverUrl` at [cover-cache.ts:10](src/services/storage/cover-cache.ts:10) also
   returns the cached URL and ignores the new blob). Fix: `saveBookCover` calls
   `revokeCoverUrl(bookId)` after the write so the next `getBookCoverUrl` re-caches fresh.
3. **Sanitizer gap** — [iframe-renderer.ts:57](src/features/reader/engine/renderer/iframe-renderer.ts:57)
   `sanitizeStylesheet` strips `expression()`/`javascript:`/`@import` but not
   `-moz-binding:` or `behavior:`. Add two more `.replace()` passes, same style as the
   existing ones.
4. **Contrast token drift** — [reader-iframe-styles.ts:141,157](src/constants/reader-iframe-styles.ts:141)
   dark-mode `--search-highlight-text` is `oklch(77.53% 0.123 78.89)` vs `index.css`'s
   `--selected: oklch(78% 0.123 78.89)` (line 230/295) — these are supposed to mirror
   each other per the file's own header comment. Fix both occurrences to `78%`.
5. **`ChapterLoader` default radius duplicates `WINDOW_RADIUS`** —
   [chapter-loader.ts:15](src/features/reader/engine/loader/chapter-loader.ts:15) hardcodes
   `constructor(windowRadius: number = 2)`. Import `WINDOW_RADIUS` from
   `windowing/chapter-window.ts` and use it as the default.
6. **`TAB_ID` reimplements `createId()`** — reading-progress-channel.ts:18-21 hand-rolls a
   UUID-or-random-string. Replace with the existing `createId()` from `src/utils/create-id.ts`.
7. **Duplicated timestamped-filename pattern** — `use-backup.ts:20` and
   `use-diagnostics.ts:6` both do `` `prefix-${new Date().toISOString().replace(/:/g, "-")}.ext` ``.
   Extract one helper (`timestampedFilename(prefix, ext)`) in `src/utils/`, used by both.
8. **`use-diagnostics.test.ts` never restores the clipboard stub** — `stubClipboard`
   (line 21) uses `Object.defineProperty` with no teardown. Add an `afterEach` that
   deletes/restores `navigator.clipboard` (check how other tests in this suite already
   restore global stubs and match that pattern).
9. **`reader-store.ts` `reset()` re-specifies fields `initialState` provides** — the
   duplication is not cosmetic: `initialState` is a plain object literal, so
   `loadedChapterIndices`/`footnoteBackStack` inside it are single shared mutable
   instances (`Set`/`Array`), and `reset()` re-declares fresh ones on purpose to avoid
   handing back an already-mutated object. Real fix: turn `initialState` into a
   `createInitialState()` factory returning fresh objects each call, used both at store
   creation and inside `reset()` — removes the duplication without reintroducing the
   shared-reference bug.
10. **Convention violations (margin instead of gap)** — `search-result-row.tsx:71,76`
    (`mt-1`, `mt-0.5`) and `ui/empty.tsx:29` (`mb-2`) per the repo's gap-not-margin rule.
    Move the spacing to the parent flex container's `gap-*` and drop the per-child margins.

## Tier 2 — Structural fixes (need a small design call, still narrowly scoped)

11. **No lock between `rebuildSearchIndex`/`ensureIndex`/`buildIndex` and `deleteBook`
    for the same book** — all single-tab races (cross-tab already goes through the
    separate `BroadcastChannel` progress mechanism, out of scope here). Fix: a tiny
    in-memory `withBookLock(bookId, fn)` helper (`Map<string, Promise<void>>` chaining) in
    a new `src/services/storage/book-lock.ts`, used by `deleteBook`,
    `rebuildSearchIndex`'s per-book step, and `buildIndex`'s callers
    (`ensureIndex`/`ensureIndexesForBooks`). Marked with a `ponytail:` comment noting the
    ceiling (in-memory, single-tab only; a cross-tab lock would need the existing
    BroadcastChannel, not worth it today).
12. **`deleteMembersForBook` not transactional with `upsertSeriesMembership`** —
    [groupings.ts:156](src/services/storage/groupings.ts:156) does plain sequential
    `await`s while `upsertSeriesMembership` already wraps its work in
    `db.transaction("rw", groupings, groupingMembers, books, …)`. Wrapping
    `deleteMembersForBook`'s body in the same table set closes the race: Dexie
    serializes overlapping `rw` transactions on shared tables.
13. **No reconciliation sweep for orphaned dependent rows** (`searchIndex`, `chapterText`,
    `groupingMembers`, legacy `bookFiles`) whose book no longer exists in `books`. Recommended
    scope: a new `reconcileOrphanedRows()` in `src/services/storage/reconcile.ts` that:
    - reads the live `books` id set once (`getAllBooks()`)
    - diffs it against distinct `bookId`s in `searchIndex`/`chapterText`/`groupingMembers`
      and against `listBookFileIds()`/OPFS legacy ids, deleting anything not in the live set
    - returns a summary count, logs failures per table (same best-effort shape as
      `deleteBook`'s cleanup), never throws
      Wire it into the existing Settings → Storage section next to "Rebuild search index"
      (`use-diagnostics.ts`/whatever drives that panel) as a manual "Repair library" action —
      matches the existing pattern of user-triggered maintenance rather than adding
      unrequested automatic startup work.

## Explicitly not doing

- **Sequential loops in `reset-library.ts` / `rebuildSearchIndex.ts`** — both already carry
  comments explaining the sequential choice is deliberate (resource contention from
  concurrent JSZip parses on low-end devices). Not a defect; leaving as-is.
- **`applyBackup`'s per-book `getBookByFileHash` sequential loop** — parallelizing risks
  correctness (shared `archiveToLocal` map, conflict/collection resolution ordering) for
  a cheap indexed lookup; not worth the complexity.
- **`export-library.ts`'s sequential per-book file/cover reads** — could be parallelized
  (pure reads, no heavy parsing) but is a minor perf nit with no reported problem; skipping
  under YAGNI unless you want it.
- **`use-shelves-screen.ts` mixing store subscription and `getState()`** — verified only one
  `getState()` call site; didn't find a clear duplicate-access bug worth a special-cased fix.
  Will leave alone unless a concrete case surfaces.
- **`use-reader-screen.ts` duplicated bookId-scoped-flag state** (`openInAnotherTabFor` /
  `remoteProgressAvailableFor`) — real duplication, but a shared `useBookScopedFlag(bookId)`
  hook is a bigger refactor of live reader-screen logic for a purely cosmetic win. Flagging
  but deferring — say if you want it done as part of this pass.
- **Real device/browser lab** — not code; needs manual QA, out of scope for this pass.

## Sequencing & verification

Execute Tier 1 items 1–10 first (low risk, independently committable), then Tier 2 items
11–13. After each item: run the relevant existing test file with `pnpm test:run <path>`
(colocated in `__tests__/`), then commit. Item 13 is new code — add one small test
(`reconcile.test.ts`) covering "orphaned row deleted, live row kept," per the project's
"non-trivial logic leaves one runnable check" rule. Before pushing the batch, run
`pnpm build` (pre-push hook will anyway) since the outstanding hardening commit `5eefde9`
also hasn't been build-verified yet — worth doing both together.
