# Sprint 4 — Task List (Gap Analysis vs Codebase)

Generated 2026-08-02 by comparing `docs/06 - Implementation/Sprint - 04 Library System.md` against the current codebase.

Legend: ✅ done · 🟡 partial · ❌ missing

---

# Already Complete (credit from prior sprints)

- **Basic library** — grid view, book cards, cover rendering (`src/features/library/components/`)
- **Metadata storage** — `title`, `author`, `language`, `createdAt`, `fileHash`, `coverBg` in `StoredBook` (`src/services/storage/storage-types.ts`)
- **Reading progress integration** — `progress`/`manualStatus` embedded on `StoredBook`, derived into `ReadingStatus` via `derive-book-status.ts`, surfaced on cards (`isNew`/`isFinished`/`isReading`, `continue-reading-banner.tsx`)
- **Storage plumbing** — Dexie (`db.ts`, schema v3), `book-repository.ts` / `cover-cache.ts` wrap raw calls; three tables: `books`, `bookFiles` (Blob), `bookCovers` (Blob)
- **Manual status actions** — `mark-book-status.ts` (finished/unread/restart)

Everything below Sprint 4 actually asks for is **missing** — this sprint hasn't started yet.

---

## Day 1 — Storage Layer

1. ✅ **OPFS storage for EPUB files** — `services/storage/opfs-file-store.ts` writes/reads EPUB blobs via `navigator.storage.getDirectory()` + `createWritable()`. Feature-detected: falls back cleanly when unsupported (e.g. Safari outside workers, where `createWritable` doesn't exist). _(done 2026-08-02)_
2. ✅ **Storage abstraction layer** — `services/storage/book-file-store.ts` is the single point deciding OPFS vs. IndexedDB; `book-repository.ts` no longer touches `db.bookFiles` directly, it delegates to this module. _(done 2026-08-02)_
3. ✅ **Migration from existing storage** — no batch migration script; `book-file-store.getBookFile()` migrates a book lazily on first read (write to OPFS, then delete the IndexedDB row) if OPFS is available. Matches the existing "no migration needed, reindex on next write" pattern from the v3 Dexie comment. _(done 2026-08-02)_

## Day 2 — Metadata Enrichment

4. ✅ **Chapter count** — `EpubParser.parseLibraryBook()` returns `chapterCount` (`parsedEpub.spine.length`, no extra parsing needed), persisted on `StoredBook.chapterCount`. _(done 2026-08-02)_
5. ✅ **Word count** — `ChapterParser.countWords()` reads every spine chapter's raw markup and sums `body.textContent` word counts (no asset resolution/sanitization needed just to count), persisted on `StoredBook.wordCount`. One malformed chapter under-counts rather than failing the whole import, matching `parseAllChapters`'s existing per-chapter fallback philosophy. _(done 2026-08-02)_
6. ✅ **Estimated reading time** — `readingTimeMinutes = Math.ceil(wordCount / 200)` (min 1), persisted on `StoredBook.readingTimeMinutes`. _(done 2026-08-02)_
7. ✅ **Book description** — `OpfParser` now also reads `dc:description`; threaded through `ParsedEpubMetadata.description` → `StoredBook.description`. _(done 2026-08-02)_
8. ✅ **Extended `StoredBook` schema** — added as plain optional fields, no Dexie version bump needed: none of the new fields need indexing (nothing in Day 3/4 sorts or filters by word count), so a `db.version(4)` bump would've been premature — matches the existing "don't add an index prematurely" note on Day 3's search task. _(done 2026-08-02)_

## Day 3 — Library Search

9. ✅ **Metadata search (title/author/description)** — clicking the header Search button now reveals an inline search input (`library-screen.tsx`), filtering via `filterBooksByQuery()` (`src/features/library/utils/filter-books.ts`), case-insensitive across title/author/description. Closes the `AUDIT_REPORT.md` [P1] "dead Search button" finding — the button now toggles the input and swaps to a close icon while open. `BookGrid`'s existing (previously unused) `isSearch` prop now drives the "No books found" empty state. _(done 2026-08-03)_
10. ✅ **Search performance** — plain `Array.filter`/`.includes()` over the in-memory library, no index added — appropriate at personal-library scale, matches the "don't add an index prematurely" call from the original gap analysis. _(done 2026-08-03)_

**Not in scope for Day 3:** full-text search (searching _inside_ book content, chapter-level inverted index) is a separate, larger feature — designed in `docs/04 - Implementation Planning/06 - Search Index Architecture.md` and explicitly sequenced into **Sprint 6** per `docs/07 - Gaps/Library-01 Sort and Filter.md`. Not a gap in this sprint; don't build it here.

## Day 4 — Sorting & Filtering

11. ✅ **Sorting** (title, author, imported date, last opened, progress, status) — `sortBooks()` (`src/features/library/utils/sort-books.ts`), 6 modes, wired to the "Sort By" chip row in the new `LibraryFilterSheet`. Replaces the old hardcoded "unfinished books first, then finished" grouping with an explicit default (`recentlyImported`) that's now just one of the six selectable modes, rather than a hidden special case competing with user-chosen sort. _(done 2026-08-03)_
12. ✅ **Filtering** (reading status, language, author, book length) — `filterBooksByCriteria()` (`src/features/library/utils/filter-books.ts`) plus `getLengthBucket()` for the word-count buckets from `docs/07 - Gaps/Library-01 Sort and Filter.md`. Closes the `AUDIT_REPORT.md` [P1] "dead Filter button" finding — it now opens `LibraryFilterSheet` (chip toggles for status/length, native `<select>` for language/author, shown only when the library actually has more than one value for that dimension). A dot indicator on the header icon shows when a filter is active, with a "Clear filters" action. _(done 2026-08-03)_
13. ✅ **Combined search + sort + filter** — `library-screen.tsx` pipes `enriched → sortBooks → filterBooksByCriteria → filterBooksByQuery`, all three composing correctly; continue-reading banner deliberately reads from the unfiltered `enriched` list so it doesn't disappear while the grid is filtered/searched. `BookGrid`'s "No books found" empty state now triggers on an active filter as well as a search query. _(done 2026-08-03)_
    13a. ✅ **Persist search/sort/filter state** — moved `query`/`sortBy`/`filters` out of `useLibraryScreen`'s local `useState` into a new `library-filter-store.ts` (Zustand `persist` middleware, localStorage key `library-filter-store`). Reopening the library now keeps the last search/sort/filter choice. `searchOpen`/`filterOpen` (panel visibility, not a filter value) stay local UI state in the hook. Verified live: set sort to "Title (A–Z)" + status filter "Reading", reloaded the page, both survived. Note: adding the second Zustand store hook call in `useLibraryScreen` made the React Compiler bail on the existing `useMemo` for `languages` (`react-hooks/preserve-manual-memoization` lint error) — fixed by dropping the `useMemo` since the computation (dedupe language list) is cheap enough not to need it. _(done 2026-08-03)_

## Day 5 — Book Management

14. ✅ **Centralized delete service** — `deleteBook()` in `services/storage/book-repository.ts` removes the EPUB file (`bookFiles.deleteBookFile`, already handled OPFS + IndexedDB fallback), the cover blob (`db.bookCovers.delete` + `revokeCoverUrl`), and the `books` row, in parallel. `features/library/actions/delete-book.ts` wraps it and syncs `libraryStore` via a new `removeBook` action. _(done 2026-08-03)_
15. ✅ **Delete EPUB / metadata / cover / progress** — `progress`/`manualStatus` live embedded on the `books` row, so deleting that row deletes them too; no separate step needed. Covered by a repository test (`book-repository.test.ts`: "deletes a book's file, cover, and metadata"). _(done 2026-08-03)_
16. ✅ **Delete search index** — confirmed N/A, as anticipated: search stays an in-memory filter (#10), nothing persisted to clean up. _(done 2026-08-03)_
17. ✅ **Destructive-action confirmation UI** — new `Delete` entry (destructive-styled, via `DropdownMenuItem`'s existing `variant="destructive"`) added to `book-card.tsx`'s dropdown, opening a new `DeleteBookDialog` component (`AlertDialog`, matches the existing `ExternalLinkDialog` pattern). Verified live: imported a throwaway fixture book, deleted it via the dropdown, confirmed via IndexedDB inspection that its `books`/`bookCovers`/`bookFiles` rows were all gone while the other book was untouched. _(done 2026-08-03)_

## Day 6 — Library UI Polish

18. ✅ **Book card sizing/spacing refinement** — cover ratio `aspect-2/3` (1.5×) → `aspect-3/4` (1.33×, ~11% shorter); card wrapper gap `2.5`→`2`; grid vertical gap `y-7`→`y-5`. Confirmed via computed-style checks, not just visual judgment. _(done 2026-08-03)_
19. ✅ **Mobile visual density** — per user-provided spec. Grid `minmax` lowered `160px`→`130px` so 2 columns hold consistently down to 320px-wide phones (previously collapsed to 1 column below ~352px container width — verified via `getComputedStyle` before/after: 1 column → `136px 136px` at 320px viewport). Touch targets (dropdown trigger, 32px) left untouched, already above the 24px AA minimum. _(done 2026-08-03)_
    19a. ✅ **Bug found via #22 (error state wiring)**: `importBook()` was writing failures (e.g. "Book already imported") into the same `libraryStore.error` field `loadLibrary()` uses, which the new error-state UI (#22) would render as a full-page "Couldn't load your library" — silently wrong before since nothing rendered that field. Fixed by removing the redundant `setError` calls from `import-book.ts`; import failures already surface via the FAB's toast (`use-import-book-fab.ts`). Verified live: a duplicate-import error now only shows a toast, library grid stays intact. _(done 2026-08-03)_
20. ✅ **Empty library state** — already existed in `book-grid.tsx` (icon + "Your library is empty" message); confirmed present, now also carries `role="status"`/`aria-live="polite"` per #24. _(confirmed 2026-08-03)_
21. ✅ **Loading state** — already existed in `book-grid.tsx` ("Loading your library…" text); confirmed present, now carries `role="status"`/`aria-live="polite"` per #24. _(confirmed 2026-08-03)_
22. ✅ **Error state** — `library-store.ts`'s `error` field was set by `load-library.ts` but never read anywhere. Plumbed through `useLibraryScreen` → `LibraryScreen` → `BookGrid`, which now renders a dedicated `role="alert"` error state (distinct styling from empty/loading) when present. Verified live by injecting a fake error into the store. _(done 2026-08-03)_
23. ⏭️ **Library animations** — skipped as speculative for this pass; nothing in the sprint doc or audit calls out a specific missing animation. Revisit if a concrete case comes up (e.g. reduced-motion pass, already deferred project-wide per the note below).
24. ✅ **`aria-live`/`role="status"` on loading & error states** — done alongside #20/#21/#22 above: loading and empty states use `role="status"`/`aria-live="polite"`, the error state uses `role="alert"` (assertive by default, appropriate for a failure). _(done 2026-08-03)_
25. ✅ **Lazy-load real book cover images** — folded in from `AUDIT_REPORT.md` [P2]; `book-cover.tsx` rendered real covers as a CSS `background-image` (no lazy-loading possible on that primitive). Switched to a native `<img loading="lazy" decoding="async">` when a real cover exists; the generated gradient/ornament fallback (no image, cheap) is unchanged. Verified live via `document.querySelector('img').loading === "lazy"`. _(done 2026-08-03)_
26. ✅ **Library title as a semantic heading** — folded in from `AUDIT_REPORT.md` [P3]; `library-screen.tsx`'s "Your Personal Collection" was a `<div className="text-[22px] ...">`; now a real `<h1>` using the documented `.section-title` token (24px, matches DESIGN.md's `headline` step) instead of the off-ramp literal `22px`. _(done 2026-08-03)_
27. ✅ **"More by Author"** — new discovery feature, not in the original sprint doc; added per user request. New route `ROUTES.LIBRARY_AUTHOR = "/library/author/:author"` (`app/screens/library-author-screen.tsx` + `features/library/hooks/use-author-screen.ts`), author name URI-encoded in the URL. Reuses `BookGrid`/`BookCard`, `enrichBookWithProgress`, and a new `filterBooksByAuthor()` (`filter-books.ts`, same style as `filterBooksByCriteria`) rather than a bespoke list; sorted by title. "More by Author" action added to both `book-card.tsx`'s dropdown (`use-book-card.ts`) and `about-book-sheet.tsx`, both driven by the same `hasMoreByAuthor`/`openMoreByAuthor` from `useBookCard` — hidden (not just disabled) when the author has only one book in the library, computed via a `libraryStore` selector counting books with a matching `author`. Verified live: dropdown entry and About Book sheet button both navigate correctly; hidden for a solo-author book; back button returns to the library. _(done 2026-08-04)_

## Day 7 — Integration & Hardening

28. ❌ **Full library regression pass** — blocked on Days 1–6.
29. ❌ **Large-library performance testing** — no fixture/benchmark analogous to the reader's `large-book.epub` perf test for a large _library_ (many books).
30. ❌ **Import → Read → Delete workflow test** — `import-book.test.ts` and `load-library.test.ts` exist; no end-to-end workflow test, and delete doesn't exist yet to test.

---

# Deferred (not this sprint)

From `AUDIT_REPORT.md`, two findings are better handled outside Sprint 4:

- **[P1] No `prefers-reduced-motion` support** — project-wide (`button.tsx`, `import-book-fab.tsx`, shared skeletons), not library-specific. Fixing it as a drive-by here means re-touching it again when the reader/settings screens get the same treatment; better as one dedicated accessibility pass across the whole app.
- **[P2] Font sizes drifted off the DESIGN.md type ramp** — a design-system/theming documentation issue. The Sprint 4 doc itself names Sprint 5 as "where user customization through theming and typography becomes the primary focus" — natural fit there instead.

---

# Suggested Sequencing

Day 1 (OPFS) and Day 2 (metadata schema bump) both touch `StoredBook`/`db.ts` — do them together in one schema version bump rather than two, per the existing "no migration needed, Dexie reindexes on next write" pattern already documented in CLAUDE.md. Days 3–4 (search/sort/filter) are pure `library-store` + derived-selector work and can follow independently. Day 5 (delete) should land after Day 1, since the delete service needs to know whether it's clearing a Dexie blob or an OPFS file. Day 6 (UI polish) is decoupled and can run in parallel with any of the above. Day 7 is integration once the rest lands.
