# Sprint 7 Day 1 — Organization Architecture Design

## Context

Sprint 7 (`docs/06 - Implementation/Sprint - 07 Library Organization & Collections.md`)
adds two grouping concepts to the library: **Series** (auto-detected from
EPUB metadata, read-only) and **Collections** (user-created, full CRUD).
`tasks/SPRINT-07-TASKS.md`'s Day 1 items (data model, storage schema,
navigation structure) plus the OPF-parsing and backfill groundwork Days 2
and 5 depend on are all designed here, since the schema can't be validated
without a working write path — same reasoning Sprint 6 Day 1 used to fold
lifecycle functions in alongside the store definition.

Nothing in the current codebase (schema v5: `books, bookFiles, bookCovers,
searchIndex, chapterText`) has any series/collection concept. This is
greenfield.

## Decisions

**1. One `groupings` table for both series and collections, discriminated
by `type`.**

```ts
interface Grouping {
  id: string; // uuid
  type: "series" | "collection";
  name: string;
  createdAt: number;
}
```

A series has no independent lifecycle beyond "the set of books that share
this metadata value" — no separate identity model needed beyond a `type`
tag on the same shape a collection uses. This also means series and
collection browsing can share one detail-screen pattern (see decision 6).

**2. Membership in a separate join table**, following the same shape
family as `searchIndex`/`chapterText` (bookId-indexed, bulk-deletable):

```ts
interface GroupingMember {
  groupingId: string;
  bookId: string;
  order: number | null; // seriesIndex for series rows; unused for collections
}
```

A join table (not an array field on `StoredBook`) because a book can
belong to many collections, and "all books in grouping X" / "all groupings
for book Y" both need to be indexed queries, not array scans.

**3. Schema — `db.version(6)`:**

```ts
db.version(6).stores({
  ...v5Stores,
  groupings: "id, type, name",
  groupingMembers: "[groupingId+bookId], groupingId, bookId",
});
```

- `[groupingId+bookId]` as the primary key prevents duplicate membership
  rows.
- `bookId` indexed alone for the delete-book cleanup path (one query finds
  all of a book's memberships, same pattern `chapterText` already uses).
- `name` indexed for case-insensitive series matching, done in JS (no
  Dexie case-insensitive index exists) — same approach every other lookup
  in this codebase already takes.
- No data migration needed — Dexie only reindexes on next write, per the
  established v1→v5 pattern.

**4. `StoredBook` gains cached `seriesName?: string` / `seriesIndex?:
number` fields**, in addition to the `groupings`/`groupingMembers` rows
derived from them. This is what makes backfill (decision 7) possible
without re-opening and re-parsing the EPUB file — the metadata is already
sitting on the book record from import.

**5. OPF parsing reads Calibre's series convention only.**
`parseMetadata()` (`src/services/epub/parsers/opf-parser.ts`) currently
only reads named `dc:*` tags — it doesn't look at generic `<meta>`
elements at all. Extend it to also read:

```xml
<meta name="calibre:series" content="..."/>
<meta name="calibre:series_index" content="..."/>
```

EPUB3's `belongs-to-collection`/`group-position` refinements are **not**
parsed — Calibre's convention covers the large majority of real-world
EPUBs, and supporting both adds a second parsing path for a convention
that's rarely populated in practice. `seriesIndex` that's missing or
non-numeric is treated as absent (`undefined`); the book still gets series
membership, sorted last within the series (tiebreak: title) rather than
being excluded.

**6. Series lifecycle — build-like, mirrors Sprint 6's index-lifecycle
discipline (a derived-data step that must never fail the thing around
it):**

- **On import** (`importBook()`): if `seriesName` is present, upsert a
  `groupings` row (`type: "series"`, case-insensitive name match against
  existing series — reuse if found, create if not) and insert a
  `groupingMembers` row with `order = seriesIndex ?? null`. Wrapped the
  same way `buildIndex()` is today — a failure here logs and does not fail
  the import.
- **On delete** (`deleteBook()`): remove all of the book's
  `groupingMembers` rows (series and any collections). If a series row's
  last member was just removed, delete the now-empty `groupings` row too
  — a series only exists because books with that metadata exist, so an
  empty one is meaningless. **Collections are never auto-deleted this
  way**, even at 0 books — a user-created shelf is deliberately kept
  around empty, unlike a derived series grouping.

**7. Backfill for pre-Sprint-7 libraries (moved into Day 1, not Day 2).**
New `ensureSeriesGroupings(bookIds: string[]): Promise<void>` in
`services/storage/groupings.ts`, following `ensureIndexesForBooks()`'s
shape: for each book, check whether it already has a series membership
row; if not, and it has cached `seriesName` on `StoredBook`, derive the
`groupings`/`groupingMembers` rows from that cached field — no file read,
no re-parse. Called once per relevant screen load (library screen, series
browsing), same "cheap per-book check, no startup migration pass" pattern
as search indexing.

Note: existing libraries imported before this schema change have no
cached `seriesName` on `StoredBook` either, since the OPF parser never
extracted it. Their books need one re-import (or a future one-time
metadata-only re-parse, out of scope here) to populate `seriesName` before
backfill can derive anything from it. This is a known limitation, not a
bug — flagged rather than silently accepted.

**8. Module boundaries, with an explicit read-only guard.**

- `src/services/storage/groupings.ts` (new, Dexie access, framework-
  agnostic — same tier as `search-index.ts`): `getGrouping`,
  `listGroupings(type?)`, `putGrouping`, `deleteGrouping`,
  `getMembersForBook(bookId)`, `getMembersForGrouping(groupingId)`,
  `addMember`, `removeMember`, `deleteMembersForBook(bookId)`,
  `ensureSeriesGroupings(bookIds)`, and `isCollection(grouping): boolean`.
- `isCollection()` is the single guard both layers share:
  - **Action layer** — `renameCollection`, `deleteCollection`,
    `addBookToCollection`, `removeBookFromCollection`
    (`src/features/library/actions/`) call it first and throw if false.
    Defense-in-depth: nothing today would call a mutation action with a
    series grouping, but the guard makes that a thrown error instead of a
    silent series mutation if a future caller gets it wrong.
  - **UI layer** — the same helper conditionally renders rename/delete
    affordances (e.g. hides the `⋮` menu's destructive options on a series
    detail screen), so the read-only rule is enforced in one place and
    reused, not reimplemented per screen.
- Series has no action files of its own — it's write-only from
  `import-book.ts` and `ensure-series-groupings` (backfill), never
  user-triggered.

**9. Navigation.**
New routes `ROUTES.LIBRARY_SERIES` (`/library/series/:groupingId`) and
`ROUTES.LIBRARY_COLLECTION` (`/library/collection/:groupingId`), screens
living in `src/app/screens/library/` alongside `library-screen.tsx` and
`library-author-screen.tsx` (per the folder reorg landed ahead of this
spec). Both reuse the `LibraryAuthorScreen` shape — header + back button +
`SortFilterButton` + `BookGrid` + `LibraryFilterSheet` — since a series or
collection detail view is the same "book grid scoped to a grouping"
pattern the author screen already established. Building the screens
themselves is Day 4 scope; Day 1 only adds the route constants and
confirms the pattern fits.

**10. Export-friendliness.**
Per the Library-02 (Backup and Export) gap note, every field above is a
plain string/number — no in-memory-only derived state. A future export can
serialize `groupings` + `groupingMembers` directly; this wasn't designed
around export, but nothing here blocks it later.

## Non-goals

- Building the series/collection browsing screens (Day 4).
- Collection CRUD UI (Day 3).
- EPUB3 `belongs-to-collection` parsing (decision 5).
- Manual reordering of books within a collection (no spec requirement;
  `order` on `GroupingMember` exists for series reading order only).
- Full library export/import (deferred to Sprint 8 per
  `Library-02 Backup and Export.md`'s own sequencing note).
- Re-parsing existing EPUB files to backfill `seriesName` for books
  imported before this schema change (decision 7's known limitation).

## Testing

- `groupings.ts` unit tests: CRUD for both types, `isCollection` guard
  (true for collections, false for series, mutation actions throw on
  series), membership add/remove, cascade delete on book removal
  (including the series-row-auto-delete-when-empty case; collections stay
  at 0 books).
- `db.ts` schema migration test: v5 → v6, existing tables/rows intact,
  following the existing per-version migration test pattern.
- `opf-parser.test.ts`: Calibre `calibre:series`/`calibre:series_index`
  extraction; missing tag (no series); non-numeric `series_index` (series
  present, index `undefined`).
- `ensure-series-groupings` backfill test: a book with cached `seriesName`
  but no membership row gets one derived, with no file/blob access in the
  test (assert the storage mock for book file reads is never called).
- `import-book.test.ts` / `delete-book.test.ts`: extend existing tests to
  cover series upsert-on-import and membership cleanup + empty-series
  deletion on delete, mirroring how these files already cover search index
  build/delete.
