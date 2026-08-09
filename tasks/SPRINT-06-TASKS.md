# Sprint 6 — Task List (Gap Analysis vs Codebase)

Generated 2026-08-07 by comparing `docs/06 - Implementation/Sprint - 06 Search.md` against the current codebase, following the format of `tasks/SPRINT-05-TASKS.md`.

Legend: ✅ done · 🟡 partial · ❌ missing

---

# Already Complete (credit from Sprint 4)

- **Metadata search** — `filterBooksByQuery()` (`src/features/library/utils/filter-books.ts`), case-insensitive match across `title`/`author`/`description`. Wired to a search icon in the library header (`useLibraryScreen`'s `searchOpen`/`query` state) that opens an inline query field. This is exactly the "metadata search first" foundation `Search Index Architecture.md` says Sprint 6 builds on top of — Sprint 6 adds book-_content_ search alongside it, not instead of it.
- **Sort/filter infrastructure** — `library-filter-store.ts`, `filterBooksByCriteria()`, `sortBooks()` — status/language/length/hide-finished filters, persisted. Sprint 6's search results will need to compose with this (see Day 3).
- **Lazy per-chapter parsing** — `EpubParser.loadChapter(index)` (`src/services/epub/epub-parser.ts`) already resolves one chapter's sanitized HTML on demand, from the EPUB blob via JSZip — not from an OPFS filesystem (see the spec-mismatch note under Day 1 below). Indexing can reuse this rather than building new chapter-extraction plumbing.
- **Reader jump-to-location** — `jumpToTocItem()` (`src/features/reader/actions/jump-to-toc-item.ts`) already does "navigate reader to a specific chapter and scroll position" for TOC clicks. Day 4's "jump to matching chapter from a search result" is the same primitive with a different caller, not new reader-navigation logic.

---

## Day 1 — Search Infrastructure

**Spec/codebase mismatch worth resolving before writing code:** `Search Index Architecture.md` describes chapter files read from OPFS (`/books/{bookId}/chapters/ch_0003.xhtml`). The actual storage layer (`services/storage/db.ts`) has no OPFS usage anywhere — the EPUB is stored as one `Blob` in Dexie's `bookFiles` table, and chapters are extracted from it on demand via `JSZip` + `EpubParser.loadChapter()`. The architecture doc predates the current storage design (or was written aspirationally); `Storage-01 Quota and Eviction.md` makes the same OPFS assumption (see Day 6). **Resolve this explicitly before Day 1**: index-building should call `loadChapter()` per spine index like the reader engine does, not read from a filesystem path that doesn't exist. Flagging so it isn't discovered mid-implementation.

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

13. ❌ **Jump to matching chapter from a search result** — thin wrapper around the existing `jumpToTocItem()`/reader-navigation primitives (see "Already Complete" above), passed a chapter index instead of a TOC item.
14. ❌ **Highlight the matched search term in the reader** — new: nothing in the current reader engine highlights arbitrary text inside the iframe's rendered chapter HTML. Needs a DOM-search-and-wrap pass scoped to the mounted chapter section, done carefully given the iframe sanitizes and windows content (`MAX_WINDOW_SIZE = 5` — see `chapter-window.ts`); the target chapter must be mounted before the highlight can be applied.
15. ❌ **Return-to-reading navigation after a search jump** — likely reuses the reader's existing back-navigation (`goBack` in `use-reader-screen.ts`) rather than new state.

### Done Criteria

🟡 Not started.

---

## Day 5 — Index Maintenance

16. ❌ **Build index during import** — hook into `importBook()` (`src/features/library/actions/import-book.ts`), after the book/file/cover writes succeed.
17. ❌ **Delete/update indexes on book removal or re-import** — hook into `deleteBook()`, and decide re-import behavior (full rebuild is simplest and safest to start with).
18. ❌ **Handle storage migration for existing libraries without an index** — books imported before Sprint 6 have no search index; needs an explicit backfill decision (lazy, on first search of an unindexed book vs. an eager one-time migration pass on app load).

    ❌ **Related Gap: [[Platform-01 Multi-Tab Concurrency|Multi-Tab Concurrency]].** The Sprint 6 spec names this explicitly under this exact day — "index writes during import are a concrete case where concurrent-tab writes could race." Confirmed against the current codebase (session note, 2026-08-07): `library-filter-store.ts` already has no cross-tab sync today (`persist` writes to localStorage per-tab, no `storage`-event listener, no `BroadcastChannel`), and the same book-progress race the gap doc describes (`services/storage`'s `updateBookProgress`-style last-write-wins) exists independently of search. Day 5 is where this sprint's own new write surface (index builds) makes the existing gap _worse_, not where the gap originates — **fix belongs here, scoped to what Day 5 actually needs**, not a general multi-tab architecture:
    - IndexedDB's own transaction guarantees are sufficient for the index _writes themselves_ being atomic — per the gap doc's own recommendation, no custom locking needed.
    - The actual risk is two tabs importing the _same_ book concurrently and each building a full index for it redundantly (wasted work, not corruption, since Dexie's `&fileHash` unique index already prevents a duplicate `books` row). Cheapest correct fix: check for an existing index for `bookId` before building one, inside the same code path that already checks `fileHash` for duplicate import.
    - Broader cross-tab sync (filters, reading progress, preferences via `BroadcastChannel`/`storage` events) is real but is the gap doc's own Sprint 8 Day 4 item, not Sprint 6's — don't over-scope this into a general fix while here for the index-write case.

### Done Criteria

🟡 Not started.

---

## Day 6 — Performance

19. ❌ **Optimize index size** — likely stop-word exclusion (Day 2) plus not indexing extremely short/common tokens; needs a concrete size measurement before optimizing further (no premature indexing scheme).
20. ❌ **Improve query speed** — should already be fast given the `word`-indexed IndexedDB store (Day 1); this day is about confirming that with a real benchmark, not adding new machinery preemptively.
21. ❌ **Large-library testing** — new perf test, `search.perf.test.ts`, following the established "regression guard, not a tight gate" pattern from `load-library.perf.test.ts`/`epub-parser.perf.test.ts` (seed N synthetic indexed books, assert a generous time budget).

    ❌ **Related Gap: [[Storage-01 Quota and Eviction|Storage Quota and Eviction]].** Named explicitly under both this day and Day 5 in the spec, and names Sprint 6 by name — "full-text indexes for a large library are a meaningful multiple of the raw book size, so quota pressure becomes more likely once Sprint 6 ships." Read in full (2026-08-07): recommends requesting `navigator.storage.persist()` at first import, surfacing `navigator.storage.estimate()` somewhere in the UI, failing index builds/imports gracefully with an explicit "storage full" message, and detecting eviction on load rather than silently showing an empty library — also assumes OPFS for the raw EPUB file, same mismatch as Day 1's. Full resolution (persistent-storage request UI, a storage-usage view, eviction detection) is real feature work with no obvious home in this sprint's Day-by-Day breakdown — scope this day's obligation to the part that's actually Sprint-6-caused: measure the _new_ index's size contribution to quota pressure and fail an index build gracefully if it would exceed available quota, rather than building the full persist/estimate/eviction-detection UI here. Flag the rest for Sprint 8 explicitly, the same way Sprint 5 deferred Infrastructure-01/Onboarding-01's full builds.

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

Before Day 1 starts: resolve the OPFS-vs-Dexie-blob mismatch in `Search Index Architecture.md` explicitly (see Day 1 above) and skim `Storage-01 Quota and Eviction.md` (relevant to both Day 5 and Day 6) — cheaper to resolve both now than mid-sprint, matching how Accessibility-01 was resolved before Sprint 5 Day 6 rather than discovered during it.
