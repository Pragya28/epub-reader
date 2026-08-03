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

14. ❌ **Centralized delete service** — no `delete-book.ts` action; nothing calls `bookFiles`/`bookCovers`/`books` deletes together.
15. ❌ **Delete EPUB / metadata / cover / progress** — `progress` and `manualStatus` live embedded on the `books` row (no separate table), so "delete progress" is a partial update, not a row delete — worth confirming the delete service handles that correctly rather than only clearing `bookFiles`/`bookCovers`.
16. ❌ **Delete search index** — N/A until #9 exists; if search stays an in-memory filter (recommended per #10), there's no persisted index to clean up.
17. ❌ **Destructive-action confirmation UI** — `book-card.tsx` has a dropdown menu (mark finished/unread/restart) but no delete entry or confirm dialog.

## Day 6 — Library UI Polish

18. ❌ **Book card sizing/spacing refinement** — current cards are functional (`book-card.tsx`, `aspect-2/3` cover); no polish pass done against this sprint's goals.
19. ❌ **Mobile visual density** — not addressed.
20. ❌ **Empty library state** — no dedicated empty-state component found under `src/features/library/components/`.
21. ❌ **Loading states** — `library-store.ts` has `isLoading`, but no evidence of a skeleton/spinner component consuming it in the grid.
22. ❌ **Error states** — `library-store.ts` has `error`, same gap as above.
23. ❌ **Library animations** — none present.
24. ❌ **`aria-live`/`role="status"` on loading & error states** — folded in from `AUDIT_REPORT.md` [P2]; build this as part of #21/#22 rather than as a separate pass, since it's the same components.
25. ❌ **Lazy-load real book cover images** — folded in from `AUDIT_REPORT.md` [P2]; `book-cover.tsx:16-20` renders covers as CSS `background-image` with no `loading="lazy"`. Natural to do alongside #18 (card sizing/spacing pass).
26. ❌ **Library title as a semantic heading** — folded in from `AUDIT_REPORT.md` [P3]; `library-screen.tsx:75` "Your Personal Collection" is a `<div>`, should be `<h1>`/`<h2>`. One-line fix, same screen as the rest of this day.
27. ❌ **"More by Author"** — new discovery feature, not in the original sprint doc; added per user request. Adds a "More by Author" action to `book-card.tsx`'s dropdown menu and `about-book-sheet.tsx`, opening a new route `/library/author/:author` (not a bottom sheet — scales better for authors with many books, leaves room to add sort/filter within the author's books, and fits the same navigation model a future Series/Collections or "Browse by Language" feature would use). Reuses `BookGrid`/`BookCard` and `filterBooksByCriteria`-style filtering rather than a bespoke list. Hide/disable the action when the author has only one book in the library.

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
