# Sprint 6 Day 5 — Index Maintenance Design

## Context

Days 1–4 of Sprint 6 built the search index (`services/search/`) and the
results UI, but nothing yet builds, deletes, or backfills the index as books
are imported, deleted, or already existed before this sprint. This is
tracked as items 16–18 in `tasks/SPRINT-06-TASKS.md`'s Day 5 section.

Most of the lifecycle plumbing already exists in `search-index.ts` /
`search-service.ts` (`hasIndex`, `putIndexEntries`, `deleteIndex`,
`buildIndex`, `ensureIndex`). Day 5 is wiring these into the import/delete
actions, plus a backfill strategy for pre-existing libraries.

## Decisions

**1. Build index during import.**
In `src/features/library/actions/import-book.ts`, after `saveImportedBook`
succeeds, call `buildIndex(bookId, file)`. The `file` blob is already in
scope. No `hasIndex` check needed here — `bookId` is freshly generated via
`createBookId()`, so it can't already have an index.

**2. Delete index on book removal.**
In `src/features/library/actions/delete-book.ts`, call `deleteIndex(bookId)`
alongside the existing storage delete.

**3. Re-import: no-op, explicitly out of scope.**
`importBook()` already throws `"Book already imported"` when `fileHash`
matches an existing book, before any write happens. There is no code path
where the same book is actually re-imported and needs its index rebuilt.
Building rebuild-on-reimport logic would be for a case the codebase doesn't
allow to occur.

**4. Lazy backfill for pre-Sprint-6 libraries.**
New function `ensureIndexesForBooks(bookIds: string[]): Promise<void>` in
`search-service.ts`. For each id: check `hasIndex()` (a single indexed Dexie
lookup, no file read). For ids missing an index, fetch the book's blob via
`bookFiles.getBookFile()` and call `buildIndex()`.

Call this from `searchLibrary()` (`src/features/library/actions/search-library.ts`)
before `findChapterMatches()`, passing the ids of all books being searched.

Cost shape: the first content search after upgrading pays a one-time
per-book indexing cost for every book that's never been searched before.
Every search after that is just N cheap `hasIndex` lookups (no file reads)
for books that are already indexed. No new UI, no startup migration pass,
no way to be "half-migrated" that needs tracking.

**5. Multi-tab race — already solved, no new work.**
The task doc calls out concurrent-tab index writes as a risk. `hasIndex()`

- the check-before-build pattern in `ensureIndex()` already covers the
  "two tabs building the same book's index redundantly" case (wasted work,
  not corruption — Dexie's own transaction guarantees make the writes
  themselves atomic). `ensureIndexesForBooks()` (decision 4) reuses this same
  `hasIndex`-then-build pattern per book, so it inherits the same protection.
  No `BroadcastChannel`/locking is added. General cross-tab sync (filters,
  progress, preferences) remains explicitly out of scope — that's Sprint 8
  Day 4's item per the task doc.

## Non-goals

- Rebuilding the index on re-import (can't happen — see decision 3).
- Eager/startup backfill migration pass.
- General cross-tab sync beyond the index-build race already covered by
  `hasIndex`.
- Any change to `search-index.ts` / `search-service.ts`'s existing lifecycle
  functions — they're reused as-is.

## Testing

- `import-book.test.ts`: importing a book results in a queryable search
  index (`hasIndex(bookId)` true, or a `findChapterMatches` hit for known
  chapter content).
- `delete-book.test.ts`: deleting a book removes its search index
  (`hasIndex(bookId)` false after delete).
- `search-service.test.ts` (or a new test file): `ensureIndexesForBooks`
  skips already-indexed books and builds only the missing ones — assert
  `buildIndex`'s side effect (index entries present) without over-asserting
  call counts on internals.
- `search-library.test.ts`: a book imported before an index existed (index
  manually deleted in the test) still produces content matches after
  `searchLibrary()` runs — proves the lazy backfill path end to end.
