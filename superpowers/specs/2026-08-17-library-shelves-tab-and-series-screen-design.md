# Sprint 7 Day 2 — Shelves Tab & Series Screen Design

## Context

`tasks/SPRINT-07-TASKS.md`'s Day 2 has one item left after Day 1's early
groundwork: the series **browsing view** (detection, read-only enforcement,
and reading order all shipped in Day 1). Scoping just "a series screen"
surfaced a bigger decision during brainstorming: the library's main screen
currently has no way to browse groupings at all, and the natural home for
one — a second tab alongside the book grid — needs to hold both Series and
Collections together, even though Collections has no create UI yet (Day 3).
This spec covers that restructuring plus the series detail screen; Day 3's
collection CRUD is unaffected and slots into the same Shelves tab later
with no rework.

## Decisions

**1. Library screen becomes two tab-routes: Books (default) and Shelves.**

`src/app/screens/library/library-screen.tsx`'s `<h1>Your Personal
Collection</h1>` is removed and replaced with a tab bar. Two static routes
render the same screen — `ROUTES.LIBRARY` ("/library", Books) and a new
`ROUTES.LIBRARY_SHELVES` ("/library/shelves") — rather than a dynamic
`:tab` param, matching this codebase's existing flat-constants convention
(`LIBRARY_AUTHOR`, `LIBRARY_SERIES`) for a fixed, small set of values. The
active tab is derived from `useLocation()` matching against
`ROUTES.LIBRARY_SHELVES`; switching tabs is a normal navigation, giving
deep-linking and back-button support for free.

The fixed header (wordmark, search, settings) and the fixed
`ContinueReadingBanner`/import FAB stay identical across both tabs — both
are library-wide actions, not Books-specific. The header's
`SortFilterButton` only applies to the Books tab's own filters and is
hidden on Shelves, which gets its own separate filter/sort control (decision
4).

**2. Shelves tab: one merged grid of `Grouping` cards, icon-differentiated.**

Series and collections render together in one grid by default (per your
"keep together" instruction), each card showing name, book count, and a
cover-stack preview (up to 4 covers — ordered by `GroupingMember.order` for
series, by member book `createdAt` for collections, since collections have
no natural reading order). Type is shown as a small icon per card — `Layers`
(lucide-react) for series, `Bookmark` for collections — with a one-line
legend near the top of the tab explaining both icons once, rather than a
text tag repeated on every card.

Until Day 3 ships collection creation, this grid is series-only in
practice; nothing here special-cases that — a `Grouping` of either type
renders identically, so Day 3 needs zero changes to this grid.

**3. New `Grouping.updatedAt` field — no schema version bump needed.**

The Shelves sort options (decision 4) need a "Last Updated" concept for
collections, and `Grouping` (shipped in Day 1) has no field for it. Adding
`updatedAt: number` to `Grouping`, stamped at creation, needs no
`db.ts` change — Dexie only requires a `version().stores()` declaration for
_indexed_ fields; a plain object field can be added to an interface and
read/written immediately. Series' "last updated" is computed at query time
instead (max of member books' `createdAt`) since a series has no
create/rename/add/remove action of its own to timestamp — only collections
need the stored field.

Day 3's rename/add-book/remove-book actions will need to bump
`updatedAt` on mutation; that wiring isn't built here (those actions don't
exist yet), but the field is ready for them.

**4. Shelves tab gets its own sort/filter control — new store, not the
existing `createFilterStore` factory.**

`createFilterStore`'s `SortOption`/`LibraryFilters` types are book-grid
shapes (status/language/length/hideFinished, recentlyOpened/progress/etc.)
that don't fit "sort a list of groupings." A small new persisted store,
`shelves-store.ts` (same `zustand` + `persist` pattern), holds:

```ts
type ShelvesSortOption = "alphabetical" | "createdAt" | "updatedAt";
type ShelvesViewMode = "merged" | "grouped";
```

- **Alphabetical** — by `Grouping.name`.
- **Created At** — series: earliest member book's `createdAt`; collection:
  its own `createdAt`.
- **Last Updated** — series: latest member book's `createdAt` (derived);
  collection: its own `updatedAt` (decision 3).
- **View mode** — `merged` (default, one grid) or `grouped` (splits into a
  "Series" section and a "Collections" section within the same tab).

**5. Series detail screen — reuses `LibraryAuthorScreen`'s shape exactly.**

New `src/app/screens/library/library-series-screen.tsx` at
`ROUTES.LIBRARY_SERIES` ("/library/series/:groupingId", already added in
Day 1): header + back button + `SortFilterButton` + `BookGrid` +
`LibraryFilterSheet`. Books are always ordered by `GroupingMember.order`
(title as tiebreak for missing/duplicate index) — never user-sortable, per
your first answer that series should read as one ordered sequence, not a
filterable grid.

`LibraryFilterSheet` gains an optional `showSort` prop (default `true`;
`false` here) to hide just its "Sort By" chip group, since everything else
— status, hide-finished, language, length — still applies and is worth
reusing as-is. `hideFinished` defaults to `false` for this screen
specifically (a series is a small curated list, not a big library that
needs decluttering) — done via a per-instance default override, not a
change to `DEFAULT_LIBRARY_FILTERS`.

**6. Entry point: "View Series" on the book card menu.**

Parity with the existing "More by Author" pattern in
`use-book-card.ts`. Shown when `book.seriesName` is set and 2+ books in
the library share it (counted client-side against `libraryStore`'s already-
loaded books, identical to how `hasMoreByAuthor` counts by `book.author` —
no new store state, no query). Navigates to
`ROUTES.LIBRARY_SERIES.replace(":groupingId", book.seriesGroupingId)`.

**7. `StoredBook` gains `seriesGroupingId?: string` — closes a Day 1 gap.**

Day 1 cached `seriesName`/`seriesIndex` on `StoredBook` but not the
grouping's own id, so nothing could build a `/library/series/:groupingId`
link from a book alone. Fixing this means `import-book.ts` needs the
grouping's id _before_ it's able to route "View Series" — but Day 1
deliberately created the series membership row only after the main book
save, in a try/catch that must never fail an otherwise-good import.

Resolved by splitting what was `upsertSeriesMembership()` into two pieces:

- **`resolveOrCreateSeriesGrouping(seriesName): Promise<string>`** (new,
  exported from `groupings.ts`) — case-insensitive match-or-create against
  the `groupings` table only (the cheap, low-risk half). `import-book.ts`
  calls this _before_ building the `book` object, in its own try/catch
  (failure leaves `seriesGroupingId: undefined` — "View Series" just won't
  show for that book until a future backfill fixes it, the same
  degraded-not-broken shape Day 1 already established elsewhere). The id
  is embedded directly into the book's single initial save — no second
  write.
- **`upsertSeriesMembership(bookId, seriesName, seriesIndex)`** — now calls
  `resolveOrCreateSeriesGrouping` + `addMember` internally, **and** also
  writes the resolved id back onto `StoredBook.seriesGroupingId` (`db.books
.update()`), so `ensureSeriesGroupings()` (Day 1's backfill) keeps
  book/membership/id in sync for pre-existing libraries too, with no
  further migration needed.

`import-book.ts`'s post-save try/catch (the "must not fail the import"
half) then calls `addMember(groupingId, bookId, seriesIndex)` directly,
using the id resolved earlier, instead of calling the combined
`upsertSeriesMembership` a second time.

## Non-goals

- Building Day 3's collection create/rename/delete/add-book/remove-book
  actions. The Shelves grid renders a `Grouping` of either type
  identically, so this is a pure follow-on with no rework here.
- Wiring `updatedAt` bumps into any mutation — nothing mutates a
  `Grouping` yet.
- A dedicated "Collections" empty-state message on the Shelves tab; the
  empty state (decision below) stays series-focused since collections
  aren't creatable yet.
- Any change to `filter-store.ts`'s existing `createFilterStore` factory —
  the Shelves sort store is intentionally separate (decision 4).
- Deep-linking to a specific Shelves sort/view-mode combination via URL —
  that state stays in the persisted `shelves-store.ts`, same as every
  other sort/filter store in this codebase.

## Empty states

- **Shelves tab, no groupings at all**: `Empty` primitive (Sprint 6),
  copy focused on what actually works today — series are detected
  automatically from book metadata; no "create a collection" CTA since
  that path doesn't exist yet.
- **Series detail screen**: not expected to be reachable empty — the
  entry point (decision 6) only appears when 2+ books already share a
  series. If a `groupingId` doesn't resolve or resolves to a
  `type: "collection"` (stale link, direct URL edit), redirect to
  `ROUTES.LIBRARY_SHELVES` rather than building a dedicated error screen.

## Testing

- `groupings.test.ts`: `resolveOrCreateSeriesGrouping` (create new vs.
  reuse case-insensitive match); `upsertSeriesMembership` now also stamps
  `seriesGroupingId` onto the book and `updatedAt` at grouping creation.
- `import-book.test.ts`: an imported book with series metadata ends up
  with `seriesGroupingId` matching the created/reused grouping's id, set
  in the same save as the rest of the book (no dependency on the
  post-save try/catch for the id itself).
- `sort-groupings.ts` (new, pure function — computes effective
  created/updated per grouping type, applies sort + merged/grouped split):
  unit tests per `ShelvesSortOption`, no DB needed.
- `use-book-card.ts`: extend existing coverage for `hasSeriesLink`
  (mirrors `hasMoreByAuthor`) and the generated route.
- `use-shelves-screen.ts` / `use-series-detail-screen.ts`: hook-level
  tests following the `use-search-screen.test.ts` precedent — the only
  other hook in this codebase with a dedicated test file (`use-author-
screen.ts` and `use-library-screen.ts` don't have one; coverage there
  leans on screen/integration tests instead). Exact split between hook-
  level and screen-level tests is an implementation-plan decision, not
  fixed here.
- `library-screen.tsx`: a rendering/routing test confirming the tab bar
  switches between Books and Shelves content and that the URL reflects
  the active tab.
