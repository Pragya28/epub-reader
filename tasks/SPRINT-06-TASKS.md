# Sprint 6 — Task List (Gap Analysis vs Codebase)

Generated 2026-08-07 by comparing `docs/06 - Implementation/Sprint - 06 Search.md` against the current codebase, following the format of `tasks/SPRINT-05-TASKS.md`.

Legend: ✅ done · 🟡 partial · ❌ missing

---

# Already Complete (credit from Sprint 4)

- **Metadata search** — `filterBooksByQuery()` (`src/features/library/utils/filter-books.ts`), case-insensitive match across `title`/`author`/`description`. Wired to a search icon in the library header (`useLibraryScreen`'s `searchOpen`/`query` state) that opens an inline query field. This is exactly the "metadata search first" foundation `Search Index Architecture.md` says Sprint 6 builds on top of — Sprint 6 adds book-_content_ search alongside it, not instead of it.
- **Sort/filter infrastructure** — `filter-store.ts` (renamed from `library-filter-store.ts` during Day 4's merge, now a factory shared with the author screen), `filterBooksByCriteria()`, `sortBooks()` — status/language/length/hide-finished filters, persisted. Sprint 6's search results will need to compose with this (see Day 3).
- **Lazy per-chapter parsing** — `EpubParser.loadChapter(index)` (`src/services/epub/epub-parser.ts`) already resolves one chapter's sanitized HTML on demand via JSZip, from whichever store currently holds the EPUB blob (see the OPFS note under Day 1 below). Indexing can reuse this rather than building new chapter-extraction plumbing.
- **Reader jump-to-location** — `jumpToTocItem()` (`src/features/reader/actions/jump-to-toc-item.ts`) already does "navigate reader to a specific chapter and scroll position" for TOC clicks. Day 4's "jump to matching chapter from a search result" is the same primitive with a different caller, not new reader-navigation logic.

---

## Day 1 — Search Infrastructure

**Spec/codebase mismatch worth resolving before writing code — corrected 2026-08-07** (an earlier pass through this doc claimed the codebase has no OPFS usage at all; that was wrong, missed `services/storage/opfs-files.ts` and `book-files.ts` on the first read). OPFS _is_ used, at whole-EPUB-file granularity: `saveBookFile()`/`getBookFile()` write/read the entire EPUB blob to OPFS when the browser supports a writable OPFS, with Dexie's `bookFiles` table as a fallback (browsers without `createWritable`, e.g. Safari outside workers) and as the source for books imported before OPFS support existed — migrated to OPFS lazily on next read, not batch-migrated. What `Search Index Architecture.md` describes doesn't match either path, though: it names individual per-_chapter_ files on OPFS (`/books/{bookId}/chapters/ch_0003.xhtml`), and nothing in the codebase ever splits an EPUB into per-chapter OPFS files — chapters are always extracted in-memory from the one whole-book blob via `JSZip`, regardless of whether that blob came from OPFS or the Dexie fallback. `Storage-01 Quota and Eviction.md` repeats the architecture doc's per-chapter-OPFS framing too (see Day 6). **Resolve this explicitly before Day 1**: index-building should call `EpubParser.loadChapter()` per spine index — the same whole-blob-then-extract path the reader engine already uses — not attempt to read individual chapter files from OPFS, which don't exist. Flagging so it isn't discovered mid-implementation.

**Decision (2026-08-09): index via `EpubParser.loadChapter()`, not a per-chapter OPFS file model.** Weighed explicitly rather than defaulted into:

- **Chosen — `loadChapter()` (in-memory, on demand).** Reuses tested infra the reader engine already depends on; no new storage format; identical pattern to how `chapter-parser.ts` already derives `wordCount` from `chapterDoc.body.textContent`, so tokenization is a third consumer of one existing extraction path, not a second parallel one. One source of truth for "what is chapter N's text" — a future EPUB-parsing fix benefits indexing for free. Cost: re-parses/re-sanitizes the book at index time in addition to at read time (wasted work if a book is imported but never opened), and `loadChapter()`'s sanitization is tuned for safe rendering, not text extraction, so it does more work than a minimal text-only pass would. Both costs are one-time-per-import, not per-search, and are unavoidable in any scheme — the raw text has to be extracted at least once regardless of where it ends up stored.
- **Rejected — per-chapter OPFS files**, as `Search Index Architecture.md` implies. Would let a chapter's plain text be cached once at import and re-read cheaply without re-unzipping via JSZip each time. But it doesn't exist anywhere in the codebase today — building it means inventing a new storage layer (write N per-chapter files at import, keep them in sync across re-import/delete) that nothing else needs, duplicating state between the EPUB blob and N per-chapter files with two places to fix any future chapter-extraction bug. No other doc or code path implies this model was ever actually built; it reads as an early architectural sketch, not a decision the current codebase committed to. Speculative infrastructure for one feature — against this project's own ladder-first, no-premature-abstraction working style.

**Future note (2026-08-09): if a full migration to per-chapter OPFS files is considered later**, not now — re-evaluated pros/cons for that specific move, not just "loadChapter vs. per-chapter files in the abstract":

- **Pros:** avoids repeat JSZip decompression on both the reader's chapter opens _and_ index builds, not just search (`loadChapter()` is the shared path today, so this benefit isn't search-specific); enables incremental re-indexing (only regenerate changed chapters instead of the whole book); cheaper index rebuilds if the search store ever gets corrupted (no full re-unzip needed); OPFS's synchronous-in-workers access makes it easier to move extraction off the main thread for large books.
- **Cons:** real migration engineering, not a toggle — same lazy-plus-eventual-batch pattern as the existing whole-blob OPFS migration, but N files per book instead of 1, with a partial-failure story to design; storage duplication, since the original EPUB blob would almost certainly still be kept (re-export, exact-byte reconstruction) — directly working against the still-unresolved Storage-01 quota gap rather than alongside it; same partial OPFS browser support (Safari outside workers) now multiplied across N file operations per book instead of 1; materially bigger Platform-01 (multi-tab) exposure — N concurrent file writes during a migration or re-index vs. today's single blob write; and critically, **no measured need yet** — this optimizes a cost (JSZip-per-chapter) nobody has profiled as an actual bottleneck.
- **Recommendation:** don't build proactively. Revisit only if profiling after Sprint 6 ships shows JSZip extraction is a measured bottleneck (large-library re-index time, or reader chapter-open latency) — and even then, try a lighter middle ground first: a per-chapter _plain-text_ cache in IndexedDB (sitting next to the search index this sprint already builds) rather than full OPFS files. Same repeat-extraction win, none of the OPFS partial-support gaps or the added multi-tab surface.

1. ❌ **Search service** — a `services/search/` slice (mirroring `services/epub/`, `services/storage/`) wrapping index build/query, framework-agnostic per the existing layering convention (`services/` = infra, no Zustand/React).
2. ❌ **IndexedDB search store** — new `db.version(4).stores({ ..., searchIndex: ... })` block, following the existing "no data migration needed, Dexie reindexes on next write" pattern documented in `CLAUDE.md`. Per the architecture doc: `word`, `bookId`, `chapter` fields, indexed on `word` and `bookId`.
3. ❌ **Search abstraction separating metadata from content search** — a thin composition layer over the existing `filterBooksByQuery()` (metadata) and the new content-search query engine (Day 3), not a rewrite of the metadata path.
4. ❌ **Index lifecycle (create, update, delete)** — exposed as plain async functions in the search service, called from Day 5's import/delete hooks.

### Done Criteria

🟡 Not started. `EpubParser.loadChapter()` and the Dexie schema pattern are the two concrete pieces of infra to build on.

---

## Day 2 — Indexing

5. ❌ **Chapter tokenization** — strip HTML from `ParsedChapter.content` (already-sanitized per-chapter HTML from `loadChapter()`), lowercase, strip punctuation, split on whitespace, drop empty tokens, per the architecture doc's tokenization steps.
6. ❌ **Inverted index construction** — one record per `{word, bookId, chapter}` occurrence, per the architecture doc's model.
7. ❌ **Word normalization** — casing (straightforward) and stop-word filtering (the architecture doc names this but doesn't specify a list — needs a small decision, not full stemming/diacritics unless the doc's later sections call for it explicitly).
8. ❌ **Index persistence to IndexedDB** — via the Day 1 search store.

### Done Criteria

🟡 Not started.

---

## Day 3 — Search Engine

9. ❌ **Combined metadata + content search** — composes Day 1's abstraction layer; needs a decision on how content-search results interleave with the existing `filterBooksByCriteria()`/`sortBooks()` pipeline in `use-library-screen.ts` (append as a distinct results mode, most likely, given content search is chapter-level and metadata search is book-level).
10. ❌ **Ranked results** — the architecture doc doesn't specify a ranking function; simplest defensible option (word-occurrence count per book, or per-chapter) should be a documented decision here, not left implicit.
11. ❌ **Highlighted snippets in results** — extract surrounding text around a match from the chapter's stripped plain text.
12. ❌ **Fast lookup against the inverted index** — direct IndexedDB query by `word` index; the architecture's whole point is avoiding a full-table scan per search.

### Done Criteria

🟡 Not started.

---

## Day 4 — Reader Integration

13. ✅ **Jump to matching chapter from a search result** — implemented via `loadReaderBook(bookId, jumpChapterIndex)`, which seeds `currentChapterIndex` from the search screen's click instead of saved progress; `useReaderEngine`'s initial-mount branch scrolls straight to that chapter's section.
14. ✅ **Highlight the matched search term in the reader** — new `highlightWordInSection()` (`src/features/reader/engine/scroll/highlight-match.ts`) does a `TreeWalker`-based DOM search-and-wrap scoped to the already-mounted target section, applied once that section exists (after the search-jump scroll, before `handleScroll()` resumes normal windowing).
15. ✅ **Return-to-reading navigation after a search jump** — reuses the existing `goBack: () => navigate(-1)` in `use-reader-screen.ts`, no new state; the search→reader navigation pushes a normal history entry.

### Done Criteria

✅ Done — search results screen (`src/app/screens/search-screen.tsx`) plus all three reader-integration items above.

---

## Day 5 — Index Maintenance

16. ✅ **Build index during import** — `importBook()` (`src/features/library/actions/import-book.ts`) calls `buildIndex(bookId, file)` after the book/file/cover writes succeed.
17. ✅ **Delete indexes on book removal** — `deleteBook()` (`src/features/library/actions/delete-book.ts`) calls `deleteIndex(bookId)` alongside the existing storage delete. Re-import-triggered rebuild was scoped out: `importBook()` already throws `"Book already imported"` on a `fileHash` match before any write happens, so there's no code path where the same book is actually re-imported and needs its index rebuilt.
18. ✅ **Lazy backfill for pre-Sprint-6 libraries** — `ensureIndexesForBooks(bookIds)` (`src/services/search/search-service.ts`) checks `hasIndex()` per book (cheap, no file read) and only builds the ones missing an index. Called from `searchLibrary()` (`src/features/library/actions/search-library.ts`) before content search runs, so any book never indexed becomes searchable on first use. No new UI, no startup migration pass. Design rationale: `superpowers/specs/2026-08-11-search-index-maintenance-design.md`.

    ✅ **Related Gap: [[Platform-01 Multi-Tab Concurrency|Multi-Tab Concurrency]].** Already covered by the pre-existing `hasIndex`-then-build pattern in `ensureIndex()`/`ensureIndexesForBooks()` — no new locking needed, IndexedDB's own transaction guarantees make the writes themselves atomic, and Dexie's `&fileHash` unique index already prevents a duplicate `books` row from concurrent imports of the same book. Broader cross-tab sync (filters, reading progress, preferences) remains out of scope — that's Sprint 8 Day 4's item.

### Done Criteria

✅ Done — build/delete hooks wired into import/delete, lazy backfill wired into `searchLibrary()`, all covered by tests in `import-book.test.ts`, `delete-book.test.ts`, `search-service.test.ts`, `search-library.test.ts`.

---

## Day 6 — Performance

19. ❌ **Optimize index size** — likely stop-word exclusion (Day 2) plus not indexing extremely short/common tokens; needs a concrete size measurement before optimizing further (no premature indexing scheme).
20. ❌ **Improve query speed** — should already be fast given the `word`-indexed IndexedDB store (Day 1); this day is about confirming that with a real benchmark, not adding new machinery preemptively.
21. ❌ **Large-library testing** — new perf test, `search.perf.test.ts`, following the established "regression guard, not a tight gate" pattern from `load-library.perf.test.ts`/`epub-parser.perf.test.ts` (seed N synthetic indexed books, assert a generous time budget).

    ❌ **Related Gap: [[Storage-01 Quota and Eviction|Storage Quota and Eviction]].** Named explicitly under both this day and Day 5 in the spec, and names Sprint 6 by name — "full-text indexes for a large library are a meaningful multiple of the raw book size, so quota pressure becomes more likely once Sprint 6 ships." Read in full (2026-08-07): recommends requesting `navigator.storage.persist()` at first import, surfacing `navigator.storage.estimate()` somewhere in the UI, failing index builds/imports gracefully with an explicit "storage full" message, and detecting eviction on load rather than silently showing an empty library. Its "OPFS (EPUB files) and IndexedDB" framing is, unlike `Search Index Architecture.md`'s per-chapter claim, actually accurate to the real storage layer (see the corrected Day 1 note) — no mismatch here, this doc just needs reading, not correcting. Full resolution (persistent-storage request UI, a storage-usage view, eviction detection) is real feature work with no obvious home in this sprint's Day-by-Day breakdown — scope this day's obligation to the part that's actually Sprint-6-caused: measure the _new_ index's size contribution to quota pressure and fail an index build gracefully if it would exceed available quota, rather than building the full persist/estimate/eviction-detection UI here. Flag the rest for Sprint 8 explicitly, the same way Sprint 5 deferred Infrastructure-01/Onboarding-01's full builds.

### Done Criteria

🟡 Not started.

---

## Day 7 — Hardening

22. ❌ **Documentation** — update `CLAUDE.md`'s Architecture section with the new `services/search/` slice, following the existing `services/{epub,storage}/` pattern already documented there.
23. ❌ **Cleanup**
24. ❌ **Full search regression suite + manual exploratory testing** — per the Sprint 4/5 Day 7 pattern: `tsc -b` + `pnpm lint` + `pnpm test:run` + `pnpm build`, plus a live pass against a real EPUB fixture (not just unit tests), same as Sprint 5 Day 3's reader-chrome work caught two live-only bugs unit tests missed.

### Done Criteria

🟡 Not started.

---

# Suggested Sequencing

Days 1–2 (infrastructure + indexing) are sequential — indexing needs the store schema and lifecycle functions from Day 1 first. Day 3 (search engine) depends on Day 2's persisted index existing. Day 4 (reader integration) depends on Day 3's results shape (needs a chapter index and match position to jump to and highlight) — could start in parallel once Day 3's data shape is settled, even before ranking/snippets are fully polished. Day 5 (index maintenance, including the Platform-01 fix) depends on Day 1's lifecycle functions but is otherwise independent of Days 2–4 and could run in parallel with them. Day 6 (performance) needs Days 1–5 complete to benchmark against real indexed data. Day 7 is integration once everything else lands — same shape as every prior sprint's Day 7.

Before Day 1 starts: resolve `Search Index Architecture.md`'s per-chapter-OPFS-file mismatch explicitly (see Day 1 above — OPFS is real in this codebase, just not at that granularity) and skim `Storage-01 Quota and Eviction.md` (relevant to both Day 5 and Day 6) — cheaper to resolve both now than mid-sprint, matching how Accessibility-01 was resolved before Sprint 5 Day 6 rather than discovered during it.
