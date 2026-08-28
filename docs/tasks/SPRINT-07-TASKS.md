# Sprint 7 — Task List (Gap Analysis vs Codebase)

Generated 2026-08-13 by comparing `central-docs/06 - Implementation/Sprint - 07 Library Organization & Collections.md` against the current codebase, following the format of `docs/tasks/SPRINT-06-TASKS.md`.

Legend: ✅ done · 🟡 partial · ❌ missing

---

# Baseline (nothing carries over from prior sprints)

Unlike Sprint 6 (which inherited sort/filter infra from Sprint 4), **Sprint 7 starts from zero** on its core subject matter. A full-codebase grep for "series"/"collection" across `src/` turned up exactly one hit — marketing copy on the library screen header ("Your Personal Collection" tagline), not a feature. No data model, storage table, OPF metadata extraction, screen, or navigation entry point exists for either concept.

What _does_ already exist and is directly reusable scaffolding for this sprint:

- **Grouped-view pattern** — `LibraryAuthorScreen` (`src/app/screens/library-author-screen.tsx`), added Sprint 6, is a working template for "browse a subset of the library grouped by some key": header + back button + `SortFilterButton`, `BookGrid` body, `LibraryFilterSheet`, driven by `useAuthorScreen` (`src/features/library/hooks/use-author-screen.ts`). Series/collection screens should follow this shape rather than inventing a new one.
- **Filter/sort factory** — `filter-store.ts`'s `createFilterStore(name)` factory already supports "each list screen gets its own persisted sort/filter instance" (used by both the library screen and the author screen). New series/collection screens plug into this rather than needing new state machinery.
- **Schema versioning pattern** — `db.ts` is at v5 (`books, bookFiles, bookCovers, searchIndex, chapterText`), no-migration-needed `db.version(n).stores(...)` pattern established across 5 prior versions.
- **Index lifecycle discipline** — Sprint 6 established "index/derived-data failures must never fail the thing around them" (build on import, delete on removal, lazy backfill) — the same shape almost certainly applies to series-detection metadata and collection-membership cleanup on delete.

---

## Day 1 — Organization Architecture

1. ✅ **Series/collection data model** — unified `Grouping`/`GroupingMember` types (`src/services/storage/storage-types.ts`), discriminated by `type: "series" | "collection"`. `StoredBook` gains cached `seriesName`/`seriesIndex` fields. `isCollection(grouping)` is the one read-only guard the (future Day 3) action layer and UI will share.
2. ✅ **Storage schema (IndexedDB)** — `db.version(6).stores(...)` adds `groupings` and `groupingMembers` (`src/services/storage/db.ts`), no data migration needed. `src/services/storage/groupings.ts` is the Dexie-access module — CRUD, membership add/remove, `deleteMembersForBook()` (cascade delete on book removal, with an emptied series grouping auto-deleted but an emptied collection kept), and `ensureSeriesGroupings()` (lazy backfill for pre-existing libraries, mirroring `ensureIndexesForBooks` from Sprint 6).
3. ✅ **Navigation structure for grouped views** — `ROUTES.LIBRARY_SERIES`/`ROUTES.LIBRARY_COLLECTION` added to `src/utils/routes.ts`. No screens or `router.tsx` wiring yet — that's Day 4, reusing the `LibraryAuthorScreen` pattern.

### Done Criteria

✅ Done — full design in `docs/superpowers/specs/2026-08-13-collections-series-data-model-design.md`, implementation plan in `docs/superpowers/plans/2026-08-13-sprint-7-day-1-organization-architecture.md`. Also folded in ahead of schedule: Calibre-only series metadata parsing (`opf-parser.ts`, originally Day 2 item 4) and the full series build-on-import/delete-cleanup/lazy-backfill lifecycle (originally split across Days 2 and 6), since the schema needed real data to validate against — see Day 2 below for what that leaves.

**Related Gap (per spec):** [[Library-02 Backup and Export]] — every field is a plain string/number (`Grouping`, `GroupingMember`, `StoredBook.seriesName`/`seriesIndex`), so a future export can serialize the schema directly; export itself remains out of scope for this sprint (see Deferred below).

---

## Day 2 — Series

4. ✅ **Automatic series detection from metadata** — `parseMetadata()` (`src/services/epub/parsers/opf-parser.ts`) now reads `<meta name="calibre:series">`/`calibre:series_index">` via a new `getMetaContent()` helper. Calibre-only, no EPUB3 `belongs-to-collection` support (deliberate scope call, see the Day 1 spec). A malformed/non-numeric `series_index` is treated as absent rather than failing the parse. Wired into `import-book.ts`: a book with `seriesName` gets its series grouping created/reused (case-insensitive name match) and membership row added, in a try/catch that logs rather than fails the import (same shape as the search-index build).
5. ✅ **Read-only series (system-detected, not user-editable)** — enforced via `isCollection()`; no `renameSeries`/`deleteSeries` action exists or will, so there's nothing for a future caller to mistakenly call.
6. ✅ **Series browsing view** — scoping "a series screen" surfaced that the library's main screen had no way to browse groupings at all, so this grew into a new **Shelves tab** on the library screen (`ROUTES.LIBRARY_SHELVES`) showing a merged Series+Collection grid (`ShelvesGrid`/`GroupingCard`, icon-differentiated, cover-stack preview with real-cover-then-book-gradient-then-placeholder priority), backed by a persisted `shelves-store.ts` sort/view-mode. Series detail itself is `library-series-screen.tsx` (`ROUTES.LIBRARY_SERIES`), the `LibraryAuthorScreen` shape exactly as anticipated, reached from a book card's new "View Series" action (`use-book-card.ts`). Full design/plan: `docs/superpowers/specs/2026-08-17-library-shelves-tab-and-series-screen-design.md` / `docs/superpowers/plans/2026-08-17-library-shelves-tab-and-series-screen.md`. _(done 2026-08-18)_
7. ✅ **Reading order within a series** — `GroupingMember.order` carries the book's `seriesIndex`, populated at series-membership creation time (both on import and via backfill). Enforced in the UI too: `use-series-detail-screen.ts` always orders by `GroupingMember.order` (title as tiebreak), never user-sortable.

### Done Criteria

✅ Done — all four items now shipped. Items 4, 5, 7 (data/lifecycle) landed early as part of Day 1's foundational work; item 6 (browsing view) landed 2026-08-18 as the Shelves tab + series detail screen. One incidental platform change came with it: the book-grid sort/filter sheet was generalized into a common `FilterSheet` component (config-driven via a `sections` prop), replacing the old book-grid-specific `LibraryFilterSheet` across the Books tab, author screen, Shelves tab, and series screen — not scoped by the sprint spec, but needed once a fourth screen (Shelves) needed sort/filter UI of its own shape.

---

## Day 3 — Collections

8. ✅ **Create collections** — `createCollection()` (`src/features/library/actions/collections.ts`), a thin wrapper over `putGrouping()`. Triggered from the library's new speed-dial FAB (see below) via `CollectionNameSheet`, a bottom sheet shared with rename.
9. ✅ **Rename collections** — `renameCollection()`, guarded by `isCollection()` so a series id can't be passed by mistake. Reuses `CollectionNameSheet` pre-filled with the current name, from the collection detail screen's "⋮" menu.
10. ✅ **Delete collections** — `deleteCollection()` cascades membership-row cleanup (`db.groupingMembers.where({groupingId}).delete()`) before deleting the grouping. Confirmation via `ConfirmDeleteDialog` (generalized from the book-only `delete-book-dialog.tsx`), with explicit reassurance copy — "This will delete the grouping. Your books will remain safe in your library." — per the Figma design review's requirement 4.
11. ✅ **Add/remove books from collections** — `addBookToCollection()`/`removeBookFromCollection()`, with `order` assigned sequentially at add-time so collections sort by add-order via the same `GroupingMember.order` field series already uses (no separate reordering mechanism, no manual drag-reorder — out of scope per the spec's "calm, minimal" framing). Add is a multi-select checklist sheet (`AddToCollectionSheet`) from the book card's new "Add to Collection" menu action; remove is a "Remove from Collection" menu action shown only inside a collection's detail screen, distinct from deleting the book itself.

### Done Criteria

✅ Done — full design pulled forward from Figma (`https://www.figma.com/design/ohsm1arYYCfzARM2RuNBI5/Librune?node-id=103-535`, reconciled in `docs/tasks/collection-management-design-review.md`) and implemented end-to-end, including Day 4's collection browsing/detail screen and Day 5's management UI/empty-state items (see below — pulled forward in the same pass rather than split across days, since the CRUD action layer and its UI are one coherent unit of work). _(done 2026-08-20)_

Two platform changes came with it, not scoped by the sprint spec but needed once collections existed as a second grouping type with its own detail screen:

- **`useGroupingBooks` + `GroupingDetailScreen` extraction** — the series and collection detail screens share identical fetch/order/enrich logic and header/grid/filter-sheet layout; rather than duplicating `use-series-detail-screen.ts`/`library-series-screen.tsx` wholesale, that shared logic was extracted so both screens are thin compositions on top. `delete-book-dialog.tsx` was similarly generalized into `confirm-delete-dialog.tsx` (title/description as props) rather than building a second near-identical delete dialog for collections.
- **Library FAB became a 3-action speed-dial** — the old Books-tab-only `ImportBookFab` and the Shelves tab's separate "New Collection" button were replaced by one arc-expanded FAB (Import Book / Import Multiple / Create Collection) on both tabs — one creation entry point instead of two scattered ones. This also added **Import Multiple** as a new capability (not previously requested by any sprint), which loops the existing `importBook()` per file, continues past individual failures, and reports one summary toast rather than one per file.

---

## Day 4 — Library Navigation

12. ✅ **Browse by series** — `library-series-screen.tsx` (`ROUTES.LIBRARY_SERIES`), folded into Day 2's delivery (see above) rather than built here — scoping "a series screen" surfaced the Shelves tab as its natural entry point, so both landed together. _(done 2026-08-18)_
13. ✅ **Browse by collection** — `library-collection-screen.tsx` (`ROUTES.LIBRARY_COLLECTION`), landed as part of Day 3's delivery (see above) — `GroupingCard`/`ShelvesGrid` needed zero changes as anticipated, the detail screen was the only missing piece. _(done 2026-08-20)_
14. ✅ **Grouped library views** — the Shelves tab's merged grid (`ShelvesGrid`) is exactly this: one grouped view spanning both series and collections, with a `merged`/`grouped` (split-by-type) toggle. Folded into Day 2's delivery. _(done 2026-08-18)_
15. ✅ **"Next in series" affordance** — `getNextInSeries()` (`src/services/storage/groupings.ts`), the book with the next-higher `GroupingMember.order` in a series. Surfaced in two places: the reader shows a "Next book" banner (reusing `ContinueReadingBanner` with its new optional `label` prop) once the current book reaches its literal end this session (`use-reader-screen.ts`'s `isBookFinished`, mirroring `derive-book-status.ts`'s finished threshold); the library's continue-reading banner switches to the same "Next book" banner once its most-recently-read candidate is `isFinished`, instead of the banner disappearing (`pickCurrentlyReadingBook` broadened to include finished books, branch in `library-screen.tsx`). _(done 2026-08-23)_

### Done Criteria

✅ Done — all four items shipped. Items 12–14 landed 2026-08-18/20 as part of Days 2–3's delivery; item 15 landed 2026-08-23.

---

## Day 5 — UX Polish

16. ✅ **Collection management UI** — rename/delete via the collection detail screen's "⋮" menu, add/remove via `AddToCollectionSheet`/"Remove from Collection", create via the library FAB. Landed as part of Day 3's delivery (see above). _(done 2026-08-20)_
17. ✅ **Empty states (no series, no collections yet)** — `Empty` (Sprint 6) now covers both levels: "No shelves yet" on the Shelves tab (points at the FAB) and "This shelf is empty" on an empty collection's detail screen, distinct copy at each level per the Figma design review. _(done 2026-08-20)_
18. ✅ **Delete flows (collection delete vs. book delete distinction)** — `ConfirmDeleteDialog` (generalized from the book-only dialog) carries collection-specific reassurance copy distinct from the book-delete dialog; "Remove from Collection" (unlinks a book from the collection) is a separate book-card menu action from "Delete" (removes the book from the library entirely), so the two are never conflated in the UI. _(done 2026-08-20)_
19. ✅ **Navigation polish** — `search-screen.tsx`'s bare `<button>` icon controls (back/clear) were below the WCAG 2.2 AA 24px touch-target minimum, inconsistent with the rest of the app's sized `Button` component (see Impeccable Audit Reconciliation). The series/collection screens that shipped earlier (`GroupingDetailScreen`, shared by both) already followed the compliant `LibraryAuthorScreen`/`Button` pattern, so this gap never propagated to a second screen — only the original search-screen instance needed fixing. Swapped both for `Button variant="ghost" size="icon"`/`"icon-sm"`. _(done 2026-08-23, via `/impeccable audit` → `/impeccable harden`)_

### Done Criteria

✅ Done — all four items shipped. Items 16–18 landed 2026-08-20 as part of Day 3's collection CRUD/UI delivery; item 19 landed 2026-08-23.

---

## Day 6 — Integration

20. ✅ **Delete behavior (book delete removes it from series/collections cleanly)** — `deleteBook()` calls `deleteMembersForBook()` unconditionally, removing every membership row for the book regardless of series vs. collection, only auto-deleting the parent grouping when it's an emptied _series_ (a collection is kept even when its last book is removed). Now test-covered for both: `delete-book.test.ts`'s "removes series membership..." case plus a new "removes collection membership but keeps the emptied collection" case. _(done 2026-08-25)_
21. ✅ **Metadata synchronization (series metadata changes on re-import)** — N/A, not a gap. `importBook()` throws `"Book already imported"` on a `fileHash` match before any write happens — there is no re-import code path for series metadata to synchronize against, so there's nothing to build here.
22. ✅ **Performance optimization for grouped views** — verified by inspection, no code change needed. Both grouped-view data hooks already follow the memoized pattern `use-library-screen.ts` was fixed to use: `use-grouping-books.ts` (series/collection detail) memoizes `enriched` and `orderedBooks` against their real deps, and `use-shelves-screen.ts` memoizes its `booksById` map and the merged/series/collections split against `[groupings, membersByGrouping, booksById, sortBy]`. Neither inherited the pre-fix unmemoized-derivation gap. _(done 2026-08-25)_

### Done Criteria

✅ Done — all three items resolved. Item 20 closed with a new test; items 21–22 closed as verified non-issues (no re-import path exists; grouped-view hooks are already memoized).

**Related Gap (per spec):** [[Library-02 Backup and Export]] — if export ships this sprint, this is where it'd need validating against delete/sync behavior. Per the Deferred section below, export itself is not being built this sprint, so this checkpoint doesn't apply yet.

---

## Day 7 — Hardening

23. ✅ **Regression testing** — `groupings-lifecycle.test.ts` exercises the full cross-feature arc the per-action unit tests only cover individually: a book belonging to a series and a collection at once, removing it from the collection without disturbing series membership, and both delete-cascade shapes (series survives when not emptied; series auto-deletes when emptied; collection always survives). `buildIndex` is mocked to a no-op in this file — these tests verify grouping mechanics, not search content, and a real full-book index (~11-14k rows) hits a fake-indexeddb-only performance ceiling on `.where(bookId)` queries at that table size (confirmed against both `.where().delete()` and `.where().primaryKeys()`+`bulkDelete()` — the query itself is the cost, not the delete mechanism). _(done 2026-08-28)_
24. ✅ **Large-library testing** — `sort-groupings.perf.test.ts`, following `load-library.perf.test.ts`'s regression-guard shape (generous budget, not a tight gate). Confirms the computation Day 6 found already memoized (`buildGroupingsWithMeta`/`sortGroupings`/`splitByType` behind the Shelves tab, and the enrich/order logic behind `use-grouping-books.ts`) doesn't itself scale badly — 500 groupings across 2,000 books, and a single grouping with 2,000 members, both well within budget. _(done 2026-08-28)_
25. ✅ **Documentation** — added the "Series & Collections (grouping)" subsection to `CLAUDE.md`, following the existing per-subsystem pattern; also corrected the adjacent Storage subsection's stale schema description (v4/four tables → v6/seven tables). _(done 2026-08-27)_

### Done Criteria

✅ Done — all three items shipped.

---

# Impeccable Audit Reconciliation

A fresh `/impeccable audit` ran 2026-08-13, replacing the stale 2026-08-07 report. **Score: 18/20 (Excellent)**, unchanged overall — Sprint 6 fixed the prior performance flag but introduced a new same-severity one. No P0/P1 findings. Full detail in `AUDIT_REPORT.md`; reconciled here:

- **P2 — `--selected` contrast (WCAG 1.4.11/1.4.3)**, `src/index.css`. Fixed 2026-08-23: retuned in both themes after a follow-up audit found the real gap was the stricter WCAG 1.4.3 (4.5:1, text) for `search-result-row.tsx`'s `<mark>` highlight, not just 1.4.11 (3:1, non-text) the 2026-08-07 fix had cleared. See `AUDIT_REPORT.md`.
- **P2 — undersized icon-only buttons on the search screen**, `src/app/screens/search-screen.tsx` (back, clear) — bare `<button>` elements below WCAG 2.2 AA's 24px touch-target minimum. Fixed 2026-08-23 (Day 5 item 19) via `Button variant="ghost" size="icon"`/`"icon-sm"`.
- **P2 — unmemoized library list derivation**, `src/features/library/hooks/use-library-screen.ts`. Fixed — the enrich→sort→filter→search pipeline is now `useMemo`'d.
- **P3 — two unthrottled scroll listeners** (`use-reader-engine.ts`, `use-library-screen.ts`). Investigated 2026-08-23: `use-reader-engine.ts`'s listener was already rAF-throttled (this finding was stale); `use-library-screen.ts`'s listener does trivially cheap work not worth throttling. Not a real issue — see `AUDIT_REPORT.md`.

---

# Deferred

- **Full export/import (Library-02 Backup and Export)** — the spec references this gap doc at both Day 1 and Day 6 as "worth including in this data model's design" / "where it should be validated," not as a Sprint 7 deliverable. The gap doc itself says export should be "scoped alongside Sprint 7" but doesn't mandate shipping it in Sprint 7 — it also names Sprint 8 (Production Polish) as a revisit point. **Deferred to Sprint 8**, per the gap doc's own sequencing note, with the caveat that Day 1's data model should stay easy to serialize (plain, storable fields; no in-memory-only derived state) so export isn't a bolt-on later.
- **Storage-01 remainder (quota persist/estimate UI, eviction detection)** — already explicitly deferred to Sprint 8 as of Sprint 6's Day 6. Collections increase what's stored (membership rows) but not by enough to change that call.
- **Faceted filtering / tag / smart-collection systems** — explicitly out of scope per the spec's own framing and `Library-01 Sort and Filter.md`'s "calm, minimal, reading-focused" direction. Not deferred so much as ruled out — flagging so no Day 3-5 implementation accidentally grows toward it (e.g. collections should not gain rule-based auto-membership).
- ~~`--selected` token contrast gap~~ — fixed 2026-08-23 (see Audit Reconciliation above).
- ~~Unthrottled scroll listeners~~ — investigated 2026-08-23, not a real issue (see Audit Reconciliation above).

---

# Suggested Sequencing

Day 1 (data model + schema) blocks everything else and should resolve two open questions before code starts: (a) whether series and collection membership live in new fields on `StoredBook` vs. dedicated tables (a `collections` + join-table shape more naturally supports many-to-many book↔collection membership than embedding an array on `StoredBook`, mirroring why `searchIndex` is its own table rather than a field), and (b) exactly which OPF metadata fields to read for series (Calibre's `calibre:series`/`calibre:series_index` `<meta>` convention is the pragmatic default — accurate for the largest share of real-world EPUBs — vs. EPUB3's less commonly populated `belongs-to-collection`). Day 2 (series) and Day 3 (collections) are independent of each other and can run in parallel once Day 1 lands — series is read-only/detected, collections are user-CRUD, they don't share logic beyond the data model. Day 4 (navigation) depends on both. Day 5 (polish) depends on Day 4. Day 6 (integration/delete/sync) can start as soon as Day 1's schema exists, in parallel with Days 2-4, since it's really "make the Day 1 schema robust under delete," not dependent on the browsing UI. Day 7 is integration once everything else lands, same shape as every prior sprint's Day 7.
