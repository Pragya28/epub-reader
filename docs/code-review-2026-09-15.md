# Code Review — 2026-09-15

Two consecutive `/code-review xhigh` passes and the fixes for both, landed together
in commit `5eefde9` on `main`. The first pass reviewed the whole `src/` tree; the
second reviewed the uncommitted diff the first pass's fixes produced.

## Method

**Pass 1 — full codebase.** The working tree was clean and matched `origin/main`,
so there was no diff to review; the scope was the whole `src/` tree. Ten finder
angles ran in parallel — five correctness (reader engine line-by-line, storage and
backup invariants, search and grouping call-site tracing, language pitfalls,
store/wrapper routing) plus reuse, simplification, efficiency, altitude and
`CLAUDE.md` conventions. Candidates were verified against the source in batches
(the first verification attempt hit a usage limit and was re-run), then a gap
sweep ran. Fifteen were reported.

**Pass 2 — the fixes themselves.** The same ten angles reviewed `git diff HEAD`
(13 files, +213/-54). Every candidate was verified; one (the `dir.keys()` type
error) was confirmed directly against `node_modules/typescript`'s `lib.dom.d.ts`
and `lib.dom.asynciterable.d.ts`. A sweep found three more. Fifteen were reported.

Pass 2 found that several pass 1 fixes were themselves wrong. The most serious,
the `loadLibrary` change, would have shown an empty library on every cold start.

Refuted or cleared during verification (not reported): pass 1's duplicated-debounce
finding in `use-reader-engine.ts` (the two timers differ — one flushes on
`visibilitychange`), pass 2's empty-`word` regex match in `snippet.ts` (every
caller passes a non-empty token), lookbehind support for `snippet.ts` (Safari 16.4+),
and the `pendingChapterLoads` scoping (declared inside the effect body, so each run
gets a fresh set). Pass 1's language-pitfall angle found nothing: no `==`
coercion bugs, falsy-zero index checks, missing awaits or unescaped regexes.

## Pass 1 findings (all 15 fixed)

Fix column is the state that shipped; where pass 2 changed a fix, the row says so.

| #   | Area                                        | Defect                                                                                                                                                                                                        | Fix                                                                                                                                                                                                       |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `reader/hooks/use-reader-engine.ts`         | `loadChapter` never checked `cancelled` after its `await`, so a stale load from a previous book called `addLoadedChapterIndex` on the shared store and windowing later skipped that chapter for the new book. | `cancelled` is checked after the await and in the catch; a cancelled load neither mounts nor marks the index loaded.                                                                                      |
| 2   | `storage/book-repository.ts`                | `saveImportedBook` wrote the file before the `books` transaction; a concurrent duplicate import failed on the unique `fileHash` index and left its OPFS blob under a book id no row references.               | The transaction is wrapped; on failure the just-written file is deleted, and a cleanup failure is logged rather than replacing the import error.                                                          |
| 3   | `storage/book-files.ts`                     | `deleteBookFile` ran OPFS and IndexedDB deletes in one `Promise.all`; a rejection after the OPFS delete succeeded left a row pointing at a deleted file.                                                      | Sequential: OPFS first (never rejects), then the legacy row, which is left free to throw so `deleteBook`'s "safely retryable" contract holds. Pass 1 swallowed that error; pass 2 reverted it (see P2-7). |
| 4   | `library/actions/import-backup.ts`          | A `fileHash` match was treated as "already have it" without checking the file exists, so a row with no file could never be repaired by re-import or restore.                                                  | `listBookFileIds()` is read once up front; a missing file is re-written from the archive.                                                                                                                 |
| 5   | `library/actions/reset-library.ts`          | The OPFS wipe iterated `db.books`, so a blob with no row survived "Delete all".                                                                                                                               | New `listOpfsFileIds()` enumerates the directory itself.                                                                                                                                                  |
| 6   | `library/actions/delete-book.ts`            | Dependent-row cleanup ran after the storage delete with results discarded, so a crash or rejected write left index/membership rows for a removed book.                                                        | Original order restored (card removed promptly) and cleanup rejections are logged; pass 2 showed the reorder tried here delayed the UI and covered only crashes (see P2-9).                               |
| 7   | `library/actions/import-backup.ts`          | `detectConflicts` had no per-book try/catch, so one manifest entry with a missing `fileHash` aborted the whole restore preview.                                                                               | Per-book try/catch; the bad entry is logged and skipped.                                                                                                                                                  |
| 8   | `library/actions/import-backup.ts`          | `manualStatus` was restored only inside the progress-conflict branch, so a book marked finished without moving its scroll position never had its status restored.                                             | Merged independently of progress resolution (final form in P2-2).                                                                                                                                         |
| 9   | `search/snippet.ts`                         | The snippet centered on the first substring match while the index matches whole tokens, so "cat" centered on "concatenate".                                                                                   | Unicode-aware whole-word match, with the substring search as fallback.                                                                                                                                    |
| 10  | `library/actions/load-library.ts`           | The silent `visibilitychange` refetch overwrote the whole `books` array with a snapshot taken before its cover fetches, undoing a delete or import that landed in between.                                    | The silent path merges into the store's current books by id; the non-silent path replaces (P2-1 explains why).                                                                                            |
| 11  | `search/search-metadata.ts`                 | Metadata search matched stop words while content search dropped them, so "the" returned metadata hits and no content hits.                                                                                    | Stop-word filtering was tried and reverted (P2-4); the divergence is now documented in the docstring.                                                                                                     |
| 12  | `reader/hooks/use-reader-engine.ts`         | Chapter loads had no in-flight tracking, so a slow parse was resubmitted every animation frame (`waitForInitialSections`) or scroll tick (`maybeLoadNext`/`maybeLoadPrevious`).                               | A per-effect `Map<index, callbacks[]>` deduplicates loads (P2-6 fixes what the first version dropped).                                                                                                    |
| 13  | `reader/engine/renderer/iframe-renderer.ts` | `sanitizeStylesheet` never handled `</style`, so a crafted stylesheet closed the `<style>` tag and injected markup into the reading iframe. The sandbox has no `allow-scripts`, so scripts did not run.       | A zero-width space breaks the sequence (P2-11 explains why not deletion).                                                                                                                                 |
| 14  | `app/app.tsx`                               | Cover blob URLs were revoked in an effect cleanup, which React StrictMode's dev double-invoke fires right after first mount.                                                                                  | Cleared from a `pagehide` listener instead (P2-12 for bfcache).                                                                                                                                           |
| 15  | `epub/parsers/chapter-parser.ts`            | Image assets were keyed by raw `src` while CSS assets were looked up by resolved path, so a file used by both minted two blobs.                                                                               | Keyed by resolved path (P2-5 for the leak this exposed).                                                                                                                                                  |

## Pass 2 findings (all 15 fixed)

| #     | Area                                          | Defect                                                                                                                                                                                                                                                       | Fix                                                                                                                       |
| ----- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| P2-1  | `library/actions/load-library.ts`             | Critical. The merge mapped over the store's current books, which is `[]` on the first load, so `setBooks([])` discarded the whole fetch and the library rendered empty on every cold start (`load-library.test.ts` "loads books into the store" would fail). | Non-silent loads replace outright; only the silent refetch, where the grid is already populated, merges.                  |
| P2-2  | `library/actions/import-backup.ts`            | Critical. The `manualStatus` check compared against a stale pre-update snapshot, but `updateBookProgress`/`resetBookProgress` clear `manualStatus` on the row, so when both sides said "finished" the value was wiped and never restored.                    | After a progress resolution the backup's `manualStatus` is re-applied unconditionally; otherwise only when it differs.    |
| P2-3  | `storage/opfs-files.ts`, `tsconfig.app.json`  | Critical. `dir.keys()` is declared only in `lib.dom.asynciterable.d.ts`; the project's `lib` had `DOM.Iterable` but not `DOM.AsyncIterable`, so `tsc -b` (and the pre-push `pnpm build`) fails with `TS2339`.                                                | `DOM.AsyncIterable` added to `lib`.                                                                                       |
| P2-4  | `search/search-metadata.ts`                   | Stop-word filtering made exact-title searches for "It" and "We" return nothing.                                                                                                                                                                              | Filtering removed; the docstring records why metadata search keeps stop words.                                            |
| P2-5  | `epub/parsers/chapter-parser.ts`              | The img and SVG-image loops minted a blob per element and overwrote the map entry, orphaning the first blob from the `assetMap.values()` revocation.                                                                                                         | Both loops check `assetMap.get(assetPath)` first and reuse it, as `resolveCssAssets` does.                                |
| P2-6  | `reader/hooks/use-reader-engine.ts`           | The dedup guard returned before invoking `onSettled`, so `maybeLoadPrevious`'s scroll-restore callback was dropped when the index was already loading, causing a visible scroll jump.                                                                        | `pendingChapterLoads` maps each index to the callbacks queued by every caller; all run when the one load settles.         |
| P2-7  | `storage/book-files.ts`, `book-repository.ts` | `deleteBookFile` swallowed a legacy-table delete failure, making the "safely retryable" comment false and letting `deleteBook` and `saveImportedBook`'s cleanup proceed while a legacy blob survived.                                                        | `deleteBookFile` throws again; `saveImportedBook` wraps its cleanup call so the original error still surfaces.            |
| P2-8  | `storage/book-repository.ts`                  | `hasBookFile` called `getBookFile`, which migrates a legacy IndexedDB file to OPFS on read, so every restore rewrote every pre-OPFS book.                                                                                                                    | `hasBookFile` in `book-files.ts` is a pure existence check.                                                               |
| P2-9  | `library/actions/delete-book.ts`              | Running dependent cleanup before the storage delete delayed the card's removal and protected only against a crash, since `Promise.allSettled` ignored ordinary rejections.                                                                                   | Original order restored; rejections logged; the comment states the two steps cannot be made atomic.                       |
| P2-10 | `library/actions/delete-book.ts`              | The recoverability comment held only for the search index; collection membership has nothing to rebuild it (series derive from `StoredBook`).                                                                                                                | Resolved by P2-9 removing the claim.                                                                                      |
| P2-11 | `reader/engine/renderer/iframe-renderer.ts`   | Deleting `</style` silently corrupted legitimate CSS such as `content: "</style>"`.                                                                                                                                                                          | `<` is followed by a zero-width space, which breaks the browser's tag-close match without removing any visible character. |
| P2-12 | `app/app.tsx`                                 | `pagehide` also fires when a page enters the back-forward cache; a restore left rendered covers pointing at revoked URLs.                                                                                                                                    | The handler skips clearing when `event.persisted` is true.                                                                |
| P2-13 | `storage/book-repository.ts`                  | `repairBookFile` (and, after P2-8, `hasBookFile`) forwarded another module's function unchanged, against `CLAUDE.md`'s "import each function directly from the module that defines it".                                                                      | Both wrappers removed; `import-backup.ts` imports from `book-files.ts` directly.                                          |
| P2-14 | `library/actions/import-backup.ts`            | The per-book `hasBookFile` check ran one OPFS/IndexedDB round trip per matched book — about 200 sequential lookups on a repeat restore of a 200-book library.                                                                                                | `listBookFileIds()`: one OPFS listing plus one legacy-table key read, then synchronous `Set` membership.                  |
| P2-15 | `reader/hooks/use-reader-engine.ts`           | The final `if (cancelled) return;` after `loadChapter`'s try/catch was dead code: no `await` sits between it and the earlier checks, so `cancelled` cannot change in between.                                                                                | Removed.                                                                                                                  |

## Verified and not fixed

Confirmed or plausible, but out of scope for the 15-finding cap or dormant today.
Each is recorded with its reasoning in `Sprint - 08B – Implementation Status.md`
under "Carried Forward".

- No reconciliation sweep for orphaned `searchIndex`/`chapterText`/`groupingMembers`
  rows or a stray legacy `bookFiles` row; collection membership cannot be rebuilt.
- `ensureSeriesGroupings` swallows per-book errors without logging;
  `deleteMembersForBook` is not transactional with `upsertSeriesMembership`.
- The "index failures must never fail the thing around them" guarantee lives in a
  try/catch at four call sites, not inside `buildIndex`; `ensureIndex` has no
  callers and is unsafe if called directly.
- `rebuildSearchIndex` and `deleteBook` have no lock between them.
- `sanitizeStylesheet` does not strip `-moz-binding:` or `behavior:`.
- `--search-highlight-text` in `reader-iframe-styles.ts` is 77.53% lightness against
  `index.css` `--selected` at 78%; `ChapterLoader`'s default radius duplicates
  `WINDOW_RADIUS`.
- Sequential loops remain in `export-library.ts`, the `reset-library.ts` OPFS
  deletes, and `applyBackup`'s per-book `getBookByFileHash`.
- Stacked `mt-*`/`mb-*` on a `gap-*` parent in `search-result-row.tsx` and
  `ui/empty.tsx`, against `CLAUDE.md`'s CSS rule.
- `saveBookCover` does not invalidate the cover cache (no production caller).
- `use-diagnostics.test.ts` never restores its `navigator.clipboard` stub.
- Smaller cleanups: `TAB_ID` reimplements `createId()`, two copies of the
  timestamped-filename pattern, duplicated bookId-scoped state in
  `use-reader-screen.ts`, a redundant `reset()` in `reader-store.ts`, mixed store
  access in `use-shelves-screen.ts`.

## Verification

- `pnpm test:run`: 749 of 750 pass. The one failure is
  `backup.perf.test.ts` › "search finds content at library scale…", which exceeds
  its 30 s budget under full-suite load; run alone, both tests in that file pass in
  about 10 s. The first pre-commit attempt failed on the same timeout under
  `vitest related`; the retry passed.
- No regression tests were added for these fixes.
- `tsc -b` / `pnpm build` were not run against the `DOM.AsyncIterable` change; the
  pre-push hook runs them.
- Not pushed at the time of writing.
