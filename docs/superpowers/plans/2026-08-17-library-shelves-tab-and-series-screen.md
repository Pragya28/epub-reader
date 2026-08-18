# Library Shelves Tab & Series Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the library screen into two tab-routes (Books / Shelves), add a merged Series+Collection grid on the new Shelves tab, and build a read-only series detail screen reachable from a book card's "View Series" action.

**Architecture:** `library-screen.tsx` becomes tab-aware via `useLocation()` against a new `ROUTES.LIBRARY_SHELVES` route, rendering either the existing `BookGrid` pipeline or a new Shelves grid of `Grouping` cards. A new pure `sort-groupings.ts` computes effective created/updated timestamps and cover art per grouping, and applies sort, driven by a new persisted `shelves-store.ts`. Sort/filter UI across every screen (Books tab, author screen, Shelves tab, series screen) is now one generic `<FilterSheet>` component fed a `sections` array built per screen by small pure builders in `filter-sections.ts` — replacing the old book-grid-specific `LibraryFilterSheet`. The series detail screen (`library-series-screen.tsx`) reuses `LibraryAuthorScreen`'s shape exactly, ordering books by `GroupingMember.order`. `groupings.ts`'s existing `upsertSeriesMembership` now returns the resolved grouping id and is called once, before `import-book.ts` builds its `book` object, closing the Day 1 gap where `StoredBook` had no `seriesGroupingId`.

**Tech Stack:** React 19 + TypeScript, Zustand (+ persist middleware), react-router-dom, Dexie/IndexedDB, Vitest + Testing Library, lucide-react icons.

**Spec:** `central-docs/06 - Implementation/Sprint - 07 - Library Organization & Architecture.md` companion design doc: `docs/superpowers/specs/2026-08-17-library-shelves-tab-and-series-screen-design.md`

## Global Constraints

- No `db.ts` schema version bump — `Grouping.updatedAt` is a plain (non-indexed) field, added directly to the interface.
- No new `zustand` factory reuse from `createFilterStore` for Shelves sort — `shelves-store.ts` is a standalone persisted store with its own shape.
- `ShelvesSortOption = "alphabetical" | "createdAt" | "updatedAt"`; `ShelvesViewMode = "merged" | "grouped"` — exact type names and literals from the spec.
- Series books are never user-sortable on the series detail screen — always ordered by `GroupingMember.order`, title as tiebreak.
- Sort and filter UI is one shared `<FilterSheet>` component, config-driven via a `sections` prop — not a per-screen sheet component and not a `showSort`-style prop toggling parts of a book-grid-specific sheet.
- No collection create/rename/delete/add-book/remove-book actions in this plan (Day 3).
- No `updatedAt` mutation wiring (nothing mutates a `Grouping` yet — only creation stamps it).
- No dedicated "Collections" empty-state copy — Shelves empty state stays series-focused.
- No URL deep-linking for Shelves sort/view-mode — state lives only in persisted `shelves-store.ts`.

---

## File Structure

**New files:**

- `src/features/library/store/shelves-store.ts` — persisted `ShelvesSortOption`/`ShelvesViewMode` store.
- `src/features/library/utils/sort-groupings.ts` — pure function: effective created/updated + cover art per grouping, plus sort.
- `src/features/library/utils/__tests__/sort-groupings.test.ts`
- `src/features/library/hooks/use-shelves-screen.ts` — data layer behind the Shelves tab.
- `src/features/library/hooks/__tests__/use-shelves-screen.test.ts`
- `src/features/library/components/shelves/grouping-card.tsx` — one card (icon, name, count, cover stack).
- `src/features/library/components/shelves/shelves-grid.tsx` — grid + legend + empty state + merged/grouped rendering.
- `src/features/library/components/filter-sheet.tsx` — the one bottom sheet every screen's sort/filter UI renders through, driven entirely by a `sections` prop.
- `src/features/library/utils/filter-sections.ts` — pure builders (`buildSortSection`, `buildLibraryFilterSections`) that turn a screen's sort/filter state into `FilterSheet` sections.
- `src/features/library/utils/__tests__/filter-sections.test.ts`
- `src/app/screens/library/library-series-screen.tsx` — series detail screen, mirrors `LibraryAuthorScreen`.
- `src/features/library/hooks/use-series-detail-screen.ts` — data layer behind it.
- `src/features/library/hooks/__tests__/use-series-detail-screen.test.ts`
- `src/features/library/hooks/__tests__/use-book-card.test.ts`
- `src/app/screens/library/__tests__/library-screen.test.tsx`

**Modified files:**

- `src/services/storage/storage-types.ts` — `Grouping.updatedAt: number`, `StoredBook.seriesGroupingId?: string`.
- `src/services/storage/groupings.ts` — `upsertSeriesMembership` now returns the resolved grouping id.
- `src/services/storage/__tests__/groupings.test.ts` — extend.
- `src/features/library/actions/import-book.ts` — call `upsertSeriesMembership` once before the main save, embed its returned id.
- `src/features/library/actions/__tests__/import-book.test.ts` — extend.
- `src/utils/routes.ts` — add `LIBRARY_SHELVES`.
- `src/app/router.tsx` — add routes for the Shelves tab and series detail.
- `src/app/screens/library/library-screen.tsx` — tab bar; the header's `SortFilterButton` and a single `<FilterSheet>` now serve both tabs, swapping `sections`/`title` based on the active one.
- `src/app/screens/library/library-author-screen.tsx` — migrated from `LibraryFilterSheet` to `<FilterSheet>` + `filter-sections.ts` builders (the only pre-existing consumer of the component this plan replaces).
- `src/features/library/store/filter-store.ts` — add `seriesFilterStore`.
- `src/features/library/hooks/use-book-card.ts` — add `hasSeriesLink`/`openViewSeries`.

**Deleted files:**

- `src/features/library/components/library-filter-sheet.tsx` — superseded by the generic `filter-sheet.tsx` (Task 6); both its callers (Books tab, author screen) migrate to the new component in the same task.

---

## Task 1: `Grouping.updatedAt` + `StoredBook.seriesGroupingId`, and `import-book.ts` embeds it in one save

**Files:**

- Modify: `src/services/storage/storage-types.ts`
- Modify: `src/services/storage/groupings.ts`
- Modify: `src/features/library/actions/import-book.ts`
- Test: `src/services/storage/__tests__/groupings.test.ts`
- Test: `src/features/library/actions/__tests__/import-book.test.ts`

**Interfaces:**

- Produces: `upsertSeriesMembership(bookId: string, seriesName: string, seriesIndex: number | null): Promise<string>` — resolves/creates the series grouping (case-insensitive match), adds membership, stamps `StoredBook.seriesGroupingId` via `db.books.update()` (a no-op when the book row doesn't exist yet — see Step 3 below), and now **returns the resolved grouping id** so `import-book.ts` can embed it directly into its own save instead of relying on that write-back.

`addMember`/`resolveOrCreateSeriesGrouping` are not split into a separate export: Dexie enforces no foreign keys between `groupingMembers` and `books`, so `upsertSeriesMembership` can safely run once, before the book row is ever written — there's no ordering hazard to design around.

- [ ] **Step 1: Write the failing tests**

Add to `src/services/storage/__tests__/groupings.test.ts`, replacing the existing first test in the `describe("upsertSeriesMembership", ...)` block:

```ts
describe("upsertSeriesMembership", () => {
  it("creates a new series grouping, returns its id, and stamps updatedAt", async () => {
    const groupingId = await upsertSeriesMembership(
      "book-1",
      "Foundation Series",
      1,
    );

    const series = await listGroupings("series");
    expect(series).toHaveLength(1);
    expect(series[0].id).toBe(groupingId);
    expect(series[0].name).toBe("Foundation Series");
    expect(series[0].updatedAt).toBeTypeOf("number");

    const members = await getMembersForBook("book-1");
    expect(members).toEqual([{ groupingId, bookId: "book-1", order: 1 }]);
  });

  it("stamps the book's seriesGroupingId when the book row already exists", async () => {
    await db.books.put({
      id: "book-1",
      title: "Foundation",
      createdAt: 1,
      fileHash: "h1",
    });

    const groupingId = await upsertSeriesMembership(
      "book-1",
      "Foundation Series",
      1,
    );

    const book = await getBook("book-1");
    expect(book?.seriesGroupingId).toBe(groupingId);
  });
});
```

Update the "reuses an existing series matched case-insensitively" test to assert on the returned id too:

```ts
it("reuses an existing series matched case-insensitively", async () => {
  const first = await upsertSeriesMembership("book-1", "Foundation Series", 1);
  const second = await upsertSeriesMembership("book-2", "foundation series", 2);

  expect(second).toBe(first);
  const series = await listGroupings("series");
  expect(series).toHaveLength(1);

  const members = await getMembersForGrouping(series[0].id);
  expect(members).toHaveLength(2);
});
```

Add the needed imports at the top of the test file:

```ts
import { getBook } from "@/services/storage/book-repository";
import { db } from "../db";
```

Add to `src/features/library/actions/__tests__/import-book.test.ts`, inside the existing `describe("importBook", ...)` block:

```ts
it("sets seriesGroupingId on the book in the same save as the rest of the metadata", async () => {
  vi.spyOn(EpubParser.prototype, "parseLibraryBook").mockResolvedValueOnce({
    metadata: {
      title: "Dune",
      author: "Frank Herbert",
      language: "en",
      description: null,
      seriesName: "Dune Saga",
      seriesIndex: 1,
    },
    cover: undefined,
    chapterCount: 1,
    wordCount: 100,
    chapterWordCounts: [100],
    readingTimeMinutes: 1,
  });

  const file = await loadFixture("valid-book.epub");
  await importBook(file);

  const [book] = await getAllBooks();
  expect(book.seriesGroupingId).toBeTypeOf("string");

  const grouping = await getGrouping(book.seriesGroupingId!);
  expect(grouping?.name).toBe("Dune Saga");

  const members = await getMembersForBook(book.id);
  expect(members).toEqual([
    { groupingId: book.seriesGroupingId, bookId: book.id, order: 1 },
  ]);
});
```

- [ ] **Step 2: Run both test files to verify they fail**

Run: `pnpm test:run src/services/storage/__tests__/groupings.test.ts src/features/library/actions/__tests__/import-book.test.ts`
Expected: FAIL — `upsertSeriesMembership` still returns `void`, and `book.seriesGroupingId` is `undefined`.

- [ ] **Step 3: Add `updatedAt` and `seriesGroupingId` to the storage types**

In `src/services/storage/storage-types.ts`, update the `Grouping` interface:

```ts
export interface Grouping {
  id: string;
  type: "series" | "collection";
  name: string;
  createdAt: number;
  updatedAt: number;
}
```

And add to `StoredBook` (next to the existing `seriesName`/`seriesIndex` fields):

```ts
  seriesName?: string;
  seriesIndex?: number;
  seriesGroupingId?: string;
```

- [ ] **Step 4: Make `upsertSeriesMembership` return the resolved id and stamp `updatedAt`**

In `src/services/storage/groupings.ts`, replace the existing `upsertSeriesMembership` function with:

```ts
/**
 * Upserts series membership for a book: reuses an existing series
 * grouping matched case-insensitively by name, or creates one. Called
 * from import (new books, before the book row is saved — see
 * import-book.ts) and the backfill (pre-existing books, where the book
 * row already exists) — see ensureSeriesGroupings. Returns the resolved
 * grouping id so a caller that runs before its own book save (import)
 * can embed the id directly instead of depending on the write-back
 * below, which also runs here for the backfill's benefit: Dexie has no
 * foreign-key constraint between groupingMembers and books, so writing
 * membership before the book row exists is safe either way — the
 * db.books.update() call is simply a no-op when there's no row yet.
 */
export async function upsertSeriesMembership(
  bookId: string,
  seriesName: string,
  seriesIndex: number | null,
): Promise<string> {
  const existing = await listGroupings("series");
  const match = existing.find(
    (grouping) => grouping.name.toLowerCase() === seriesName.toLowerCase(),
  );

  const groupingId = match?.id ?? createId();

  if (!match) {
    await putGrouping({
      id: groupingId,
      type: "series",
      name: seriesName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  await addMember(groupingId, bookId, seriesIndex);
  await db.books.update(bookId, { seriesGroupingId: groupingId });

  return groupingId;
}
```

- [ ] **Step 5: Call `upsertSeriesMembership` once, before the main save, in `import-book.ts`**

In `src/features/library/actions/import-book.ts`, replace the block that builds `bookId`/`fileHash`/duplicate-check through the `book` object, and remove the old post-save `upsertSeriesMembership` try/catch entirely (its one job — adding membership — now happens here):

```ts
// 3. Generate app ID
const bookId = createId();

// 4. Hash file for duplicate detection
const fileHash = await hashFile(file);

// 5. Check duplicates
const existingBook = store.books.find((book) => book.fileHash === fileHash);

if (existingBook) {
  throw new Error("Book already imported");
}

const createdAt = Date.now();

// Resolved before the main save so its id can be embedded directly
// into the book row — closes the Day 1 gap where StoredBook had no
// seriesGroupingId to build a "View Series" link from. Its own
// try/catch: a failure here must not fail an otherwise-good import,
// it just leaves seriesGroupingId undefined until a future backfill
// (ensureSeriesGroupings) fixes it — same degraded-not-broken shape
// as the index-build try/catch below.
let seriesGroupingId: string | undefined;
if (metadata.seriesName) {
  try {
    seriesGroupingId = await upsertSeriesMembership(
      bookId,
      metadata.seriesName,
      metadata.seriesIndex ?? null,
    );
  } catch (error) {
    logger.error("failed to upsert series grouping for imported book", error);
  }
}

const book: StoredBook = {
  id: bookId,
  title: metadata.title,
  author: metadata.author,
  language: metadata.language,
  description: metadata.description,
  chapterCount,
  wordCount,
  chapterWordCounts,
  readingTimeMinutes,
  seriesName: metadata.seriesName,
  seriesIndex: metadata.seriesIndex,
  seriesGroupingId,
  createdAt,
  fileHash,
  progress: {
    chapterIndex: 0,
    totalChapters: chapterCount,
    scrollFraction: 0,
    anchorPath: null,
    atDocumentEnd: false,
    percent: 0,
    updatedAt: createdAt,
  },
};
```

Remove the now-redundant post-save block that previously called `upsertSeriesMembership` again after `store.addBook(book)` — membership was already added in the pre-save call above.

- [ ] **Step 6: Run both test files to verify they pass**

Run: `pnpm test:run src/services/storage/__tests__/groupings.test.ts src/features/library/actions/__tests__/import-book.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/services/storage/storage-types.ts src/services/storage/groupings.ts src/services/storage/__tests__/groupings.test.ts src/features/library/actions/import-book.ts src/features/library/actions/__tests__/import-book.test.ts
git commit -m "feat(storage): add Grouping.updatedAt, return the resolved id from upsertSeriesMembership, and embed seriesGroupingId at import"
```

---

## Task 2: `sort-groupings.ts` — pure sort function with cover art folded in

**Files:**

- Create: `src/features/library/utils/sort-groupings.ts`
- Test: `src/features/library/utils/__tests__/sort-groupings.test.ts`

**Interfaces:**

- Consumes: `Grouping`, `GroupingMember`, `StoredBook` from `@/services/storage/storage-types`.
- Produces:
  ```ts
  export type ShelvesSortOption = "alphabetical" | "createdAt" | "updatedAt";
  export type ShelvesViewMode = "merged" | "grouped";

  export interface GroupingWithMeta {
    grouping: Grouping;
    memberBookIds: string[];
    effectiveCreatedAt: number;
    effectiveUpdatedAt: number;
    covers: string[]; // up to 4 cover URLs, ordered by member order/createdAt
  }

  export function buildGroupingsWithMeta(
    groupings: Grouping[],
    membersByGrouping: Map<string, GroupingMember[]>,
    booksById: Map<string, StoredBook>,
  ): GroupingWithMeta[];

  export function sortGroupings(
    items: GroupingWithMeta[],
    sortBy: ShelvesSortOption,
  ): GroupingWithMeta[];

  export function splitByType(items: GroupingWithMeta[]): {
    merged: GroupingWithMeta[];
    series: GroupingWithMeta[];
    collections: GroupingWithMeta[];
  };
  ```

`covers` is computed once here, at build time, from the same `memberBookIds`/`booksById` inputs already needed for the timestamp derivation — no separate per-render closure is needed downstream. `splitByType` always returns all three lists; the caller picks whichever it needs for the current view mode, instead of the function branching on a `viewMode` argument.

- [ ] **Step 1: Write the failing tests**

Create `src/features/library/utils/__tests__/sort-groupings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildGroupingsWithMeta,
  sortGroupings,
  splitByType,
} from "../sort-groupings";
import type {
  Grouping,
  GroupingMember,
  StoredBook,
} from "@/services/storage/storage-types";

function makeBook(overrides: Partial<StoredBook> = {}): StoredBook {
  return {
    id: "b1",
    title: "Book",
    createdAt: 0,
    fileHash: "h",
    ...overrides,
  };
}

describe("buildGroupingsWithMeta", () => {
  it("derives a series's effective timestamps from its member books' createdAt", () => {
    const series: Grouping = {
      id: "g1",
      type: "series",
      name: "Foundation",
      createdAt: 1,
      updatedAt: 1,
    };
    const members: GroupingMember[] = [
      { groupingId: "g1", bookId: "b1", order: 1 },
      { groupingId: "g1", bookId: "b2", order: 2 },
    ];
    const books = new Map([
      ["b1", makeBook({ id: "b1", createdAt: 100, coverBg: "cover-1" })],
      ["b2", makeBook({ id: "b2", createdAt: 300, coverBg: "cover-2" })],
    ]);

    const [result] = buildGroupingsWithMeta(
      [series],
      new Map([["g1", members]]),
      books,
    );

    expect(result.effectiveCreatedAt).toBe(100);
    expect(result.effectiveUpdatedAt).toBe(300);
    expect(result.memberBookIds).toEqual(["b1", "b2"]);
    expect(result.covers).toEqual(["cover-1", "cover-2"]);
  });

  it("uses a collection's own createdAt/updatedAt directly", () => {
    const collection: Grouping = {
      id: "g2",
      type: "collection",
      name: "Favorites",
      createdAt: 50,
      updatedAt: 75,
    };

    const [result] = buildGroupingsWithMeta(
      [collection],
      new Map([["g2", []]]),
      new Map(),
    );

    expect(result.effectiveCreatedAt).toBe(50);
    expect(result.effectiveUpdatedAt).toBe(75);
    expect(result.memberBookIds).toEqual([]);
    expect(result.covers).toEqual([]);
  });

  it("caps covers at 4 and skips books with no cover", () => {
    const series: Grouping = {
      id: "g1",
      type: "series",
      name: "Foundation",
      createdAt: 1,
      updatedAt: 1,
    };
    const members: GroupingMember[] = [1, 2, 3, 4, 5].map((n) => ({
      groupingId: "g1",
      bookId: `b${n}`,
      order: n,
    }));
    const books = new Map(
      [1, 2, 3, 4, 5].map((n) => [
        `b${n}`,
        makeBook({ id: `b${n}`, coverBg: n === 3 ? undefined : `cover-${n}` }),
      ]),
    );

    const [result] = buildGroupingsWithMeta(
      [series],
      new Map([["g1", members]]),
      books,
    );

    expect(result.covers).toEqual(["cover-1", "cover-2", "cover-4", "cover-5"]);
  });
});

describe("sortGroupings", () => {
  const items = buildGroupingsWithMeta(
    [
      {
        id: "g1",
        type: "series",
        name: "Zed Series",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "g2",
        type: "collection",
        name: "Alpha Shelf",
        createdAt: 3,
        updatedAt: 9,
      },
    ],
    new Map([
      ["g1", [{ groupingId: "g1", bookId: "b1", order: 1 }]],
      ["g2", []],
    ]),
    new Map([["b1", makeBook({ id: "b1", createdAt: 5 })]]),
  );

  it("sorts alphabetically by name", () => {
    const result = sortGroupings(items, "alphabetical");
    expect(result.map((i) => i.grouping.name)).toEqual([
      "Alpha Shelf",
      "Zed Series",
    ]);
  });

  it("sorts by effective createdAt", () => {
    const result = sortGroupings(items, "createdAt");
    expect(result.map((i) => i.grouping.id)).toEqual(["g2", "g1"]);
  });

  it("sorts by effective updatedAt", () => {
    const result = sortGroupings(items, "updatedAt");
    expect(result.map((i) => i.grouping.id)).toEqual(["g2", "g1"]);
  });
});

describe("splitByType", () => {
  it("returns merged, series, and collections lists together", () => {
    const items = buildGroupingsWithMeta(
      [
        { id: "g1", type: "series", name: "A", createdAt: 1, updatedAt: 1 },
        { id: "g2", type: "collection", name: "B", createdAt: 1, updatedAt: 1 },
      ],
      new Map([
        ["g1", []],
        ["g2", []],
      ]),
      new Map(),
    );

    const result = splitByType(items);

    expect(result.merged).toHaveLength(2);
    expect(result.series).toHaveLength(1);
    expect(result.collections).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:run src/features/library/utils/__tests__/sort-groupings.test.ts`
Expected: FAIL — `../sort-groupings` module not found.

- [ ] **Step 3: Implement `sort-groupings.ts`**

Create `src/features/library/utils/sort-groupings.ts`:

```ts
import type {
  Grouping,
  GroupingMember,
  StoredBook,
} from "@/services/storage/storage-types";

export type ShelvesSortOption = "alphabetical" | "createdAt" | "updatedAt";
export type ShelvesViewMode = "merged" | "grouped";

const MAX_COVERS = 4;

export interface GroupingWithMeta {
  grouping: Grouping;
  memberBookIds: string[];
  effectiveCreatedAt: number;
  effectiveUpdatedAt: number;
  covers: string[];
}

/**
 * A series has no create/rename/add/remove action of its own to stamp
 * createdAt/updatedAt on the Grouping row itself, so both are derived from
 * its member books' createdAt (earliest = created, latest = updated) —
 * see decision 3/4 of the Shelves tab spec. A collection uses its own
 * stored fields directly. Cover art is derived here too (member order,
 * capped at MAX_COVERS, skipping books with no cover) so downstream
 * consumers read a plain field instead of recomputing it per render.
 */
export function buildGroupingsWithMeta(
  groupings: Grouping[],
  membersByGrouping: Map<string, GroupingMember[]>,
  booksById: Map<string, StoredBook>,
): GroupingWithMeta[] {
  return groupings.map((grouping) => {
    const members = membersByGrouping.get(grouping.id) ?? [];
    const memberBookIds = members.map((member) => member.bookId);
    const covers = memberBookIds
      .map((bookId) => booksById.get(bookId)?.coverBg)
      .filter((url): url is string => !!url)
      .slice(0, MAX_COVERS);

    if (grouping.type === "collection") {
      return {
        grouping,
        memberBookIds,
        effectiveCreatedAt: grouping.createdAt,
        effectiveUpdatedAt: grouping.updatedAt,
        covers,
      };
    }

    const memberCreatedAts = memberBookIds
      .map((bookId) => booksById.get(bookId)?.createdAt)
      .filter((value): value is number => value != null);

    return {
      grouping,
      memberBookIds,
      effectiveCreatedAt:
        memberCreatedAts.length > 0
          ? Math.min(...memberCreatedAts)
          : grouping.createdAt,
      effectiveUpdatedAt:
        memberCreatedAts.length > 0
          ? Math.max(...memberCreatedAts)
          : grouping.updatedAt,
      covers,
    };
  });
}

export function sortGroupings(
  items: GroupingWithMeta[],
  sortBy: ShelvesSortOption,
): GroupingWithMeta[] {
  const sorted = [...items];

  switch (sortBy) {
    case "alphabetical":
      return sorted.sort((a, b) =>
        a.grouping.name.localeCompare(b.grouping.name),
      );
    case "createdAt":
      return sorted.sort((a, b) => b.effectiveCreatedAt - a.effectiveCreatedAt);
    case "updatedAt":
      return sorted.sort((a, b) => b.effectiveUpdatedAt - a.effectiveUpdatedAt);
  }
}

export function splitByType(items: GroupingWithMeta[]): {
  merged: GroupingWithMeta[];
  series: GroupingWithMeta[];
  collections: GroupingWithMeta[];
} {
  return {
    merged: items,
    series: items.filter((item) => item.grouping.type === "series"),
    collections: items.filter((item) => item.grouping.type === "collection"),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:run src/features/library/utils/__tests__/sort-groupings.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/library/utils/sort-groupings.ts src/features/library/utils/__tests__/sort-groupings.test.ts
git commit -m "feat(library): add sort-groupings pure function for the Shelves tab"
```

---

## Task 3: `shelves-store.ts` — persisted sort/view-mode store

**Files:**

- Create: `src/features/library/store/shelves-store.ts`

**Interfaces:**

- Consumes: `ShelvesSortOption`, `ShelvesViewMode` from `../utils/sort-groupings` (Task 2).
- Produces: `shelvesStore` — a zustand store with `sortBy: ShelvesSortOption`, `viewMode: ShelvesViewMode`, `setSortBy`, `setViewMode`.

No dedicated test — this is thin persisted config, following the same-shape `filter-store.ts` which also has no test file.

- [ ] **Step 1: Implement the store**

Create `src/features/library/store/shelves-store.ts`:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  ShelvesSortOption,
  ShelvesViewMode,
} from "../utils/sort-groupings";

interface ShelvesStore {
  sortBy: ShelvesSortOption;
  viewMode: ShelvesViewMode;
  setSortBy: (sortBy: ShelvesSortOption) => void;
  setViewMode: (viewMode: ShelvesViewMode) => void;
}

// Separate from filter-store.ts's createFilterStore factory: that factory's
// SortOption/LibraryFilters shapes are book-grid specific (status/language/
// length/hideFinished) and don't fit "sort a list of groupings."
export const shelvesStore = create<ShelvesStore>()(
  persist(
    (set) => ({
      sortBy: "alphabetical",
      viewMode: "merged",
      setSortBy: (sortBy) => set({ sortBy }),
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    { name: "shelves-store" },
  ),
);
```

- [ ] **Step 2: Commit**

```bash
git add src/features/library/store/shelves-store.ts
git commit -m "feat(library): add persisted shelves-store for Shelves tab sort/view-mode"
```

---

## Task 4: `use-shelves-screen.ts` — data layer behind the Shelves tab

**Files:**

- Create: `src/features/library/hooks/use-shelves-screen.ts`
- Test: `src/features/library/hooks/__tests__/use-shelves-screen.test.ts`

**Interfaces:**

- Consumes: `listGroupings`, `getMembersForGrouping` (from `@/services/storage/groupings`); `libraryStore` (books, already loaded by the Books tab / `loadLibrary()`); `shelvesStore` (Task 3); `buildGroupingsWithMeta`, `sortGroupings`, `splitByType` (Task 2).
- Produces:

  ```ts
  export function useShelvesScreen(): {
    isLoading: boolean;
    sortBy: ShelvesSortOption;
    setSortBy: (v: ShelvesSortOption) => void;
    viewMode: ShelvesViewMode;
    setViewMode: (v: ShelvesViewMode) => void;
    isEmpty: boolean;
    merged: GroupingWithMeta[];
    series: GroupingWithMeta[];
    collections: GroupingWithMeta[];
  };
  ```

- [ ] **Step 1: Write the failing test**

Create `src/features/library/hooks/__tests__/use-shelves-screen.test.ts`:

```ts
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useShelvesScreen } from "../use-shelves-screen";
import { libraryStore } from "../../store/library-store";
import { shelvesStore } from "../../store/shelves-store";
import type { StoredBook } from "@/services/storage/storage-types";

const book1: StoredBook = {
  id: "b1",
  title: "Foundation",
  createdAt: 100,
  fileHash: "h1",
  coverBg: "cover-1",
} as StoredBook;
const book2: StoredBook = {
  id: "b2",
  title: "Foundation and Empire",
  createdAt: 200,
  fileHash: "h2",
  coverBg: "cover-2",
} as StoredBook;

vi.mock("@/services/storage/groupings", () => ({
  listGroupings: vi.fn(async () => [
    {
      id: "g1",
      type: "series",
      name: "Foundation Series",
      createdAt: 1,
      updatedAt: 1,
    },
  ]),
  getMembersForGrouping: vi.fn(async (groupingId: string) =>
    groupingId === "g1"
      ? [
          { groupingId: "g1", bookId: "b1", order: 1 },
          { groupingId: "g1", bookId: "b2", order: 2 },
        ]
      : [],
  ),
}));

describe("useShelvesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    libraryStore.setState({
      books: [book1, book2],
      isLoading: false,
      error: null,
    });
    shelvesStore.setState({ sortBy: "alphabetical", viewMode: "merged" });
  });

  it("loads groupings with member covers, ordered by GroupingMember.order", async () => {
    const { result } = renderHook(() => useShelvesScreen());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.merged).toHaveLength(1);
    expect(result.current.merged[0].covers).toEqual(["cover-1", "cover-2"]);
    expect(result.current.isEmpty).toBe(false);
  });

  it("reports empty when there are no groupings", async () => {
    const groupings = await import("@/services/storage/groupings");
    vi.mocked(groupings.listGroupings).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useShelvesScreen());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEmpty).toBe(true);
  });

  it("switches view mode via shelvesStore", async () => {
    const { result } = renderHook(() => useShelvesScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setViewMode("grouped"));

    await waitFor(() => expect(result.current.viewMode).toBe("grouped"));
    expect(result.current.series).toHaveLength(1);
    expect(result.current.collections).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run src/features/library/hooks/__tests__/use-shelves-screen.test.ts`
Expected: FAIL — `../use-shelves-screen` module not found.

- [ ] **Step 3: Implement the hook**

Create `src/features/library/hooks/use-shelves-screen.ts`:

```ts
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  listGroupings,
  getMembersForGrouping,
} from "@/services/storage/groupings";
import type {
  Grouping,
  GroupingMember,
} from "@/services/storage/storage-types";
import { libraryStore } from "../store/library-store";
import { shelvesStore } from "../store/shelves-store";
import {
  buildGroupingsWithMeta,
  sortGroupings,
  splitByType,
} from "../utils/sort-groupings";

/**
 * Data layer behind the Shelves tab: loads every Grouping + its members,
 * derives sort metadata and cover art, and exposes merged/series/
 * collections views per shelvesStore. Reuses libraryStore's already-loaded
 * books (populated by the Books tab's loadLibrary()) for cover art instead
 * of a separate fetch — same pattern as hasMoreByAuthor counting
 * client-side against the loaded library.
 */
export function useShelvesScreen() {
  const { books } = libraryStore();
  const [groupings, setGroupings] = useState<Grouping[]>([]);
  const [membersByGrouping, setMembersByGrouping] = useState<
    Map<string, GroupingMember[]>
  >(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const { sortBy, setSortBy, viewMode, setViewMode } = shelvesStore(
    useShallow((state) => ({
      sortBy: state.sortBy,
      setSortBy: state.setSortBy,
      viewMode: state.viewMode,
      setViewMode: state.setViewMode,
    })),
  );

  useEffect(() => {
    let cancelled = false;

    void listGroupings().then(async (all) => {
      const entries = await Promise.all(
        all.map(
          async (grouping) =>
            [grouping.id, await getMembersForGrouping(grouping.id)] as const,
        ),
      );
      if (cancelled) return;
      setGroupings(all);
      setMembersByGrouping(new Map(entries));
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const booksById = useMemo(
    () => new Map(books.map((book) => [book.id, book])),
    [books],
  );

  // One memo, not three: buildGroupingsWithMeta/sortGroupings/splitByType
  // are cheap array ops over a handful of groupings — chaining a separate
  // useMemo per stage only adds re-render bookkeeping, not real caching.
  const { merged, series, collections } = useMemo(
    () =>
      splitByType(
        sortGroupings(
          buildGroupingsWithMeta(groupings, membersByGrouping, booksById),
          sortBy,
        ),
      ),
    [groupings, membersByGrouping, booksById, sortBy],
  );

  return {
    isLoading,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    isEmpty: !isLoading && groupings.length === 0,
    merged,
    series,
    collections,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:run src/features/library/hooks/__tests__/use-shelves-screen.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/library/hooks/use-shelves-screen.ts src/features/library/hooks/__tests__/use-shelves-screen.test.ts
git commit -m "feat(library): add use-shelves-screen hook"
```

---

## Task 5: Shelves UI — `GroupingCard` + `ShelvesGrid`

**Files:**

- Create: `src/features/library/components/shelves/grouping-card.tsx`
- Create: `src/features/library/components/shelves/shelves-grid.tsx`

**Interfaces:**

- Consumes: `GroupingWithMeta` (Task 2), return shape of `useShelvesScreen()` (Task 4), `Empty`/`EmptyHeader`/`EmptyTitle`/`EmptyDescription`/`EmptyMedia` from `@/components/ui/empty`, `ROUTES` from `@/utils/routes`.
- Produces: `<ShelvesGrid />` — legend + grid + empty/loading states only. Sort and view-mode selection live in the header's shared `<FilterSheet>` (Task 6/8), not inside the grid — `ShelvesGrid` just renders whichever of `merged`/`series`/`collections` the current `viewMode` calls for.

No dedicated tests for this task — matches the codebase's existing convention that presentational grid/card components (`BookGrid`, `BookCard`) have no component-level tests; coverage comes from the `library-screen.tsx` routing test (Task 8) and the hook test above.

- [ ] **Step 1: Implement `GroupingCard`**

Create `src/features/library/components/shelves/grouping-card.tsx`:

```tsx
import type { FC } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Layers } from "lucide-react";

import { ROUTES } from "@/utils/routes";
import type { GroupingWithMeta } from "../../utils/sort-groupings";

interface GroupingCardProps {
  item: GroupingWithMeta;
}

export const GroupingCard: FC<GroupingCardProps> = ({ item }) => {
  const { grouping, memberBookIds, covers } = item;
  const Icon = grouping.type === "series" ? Layers : Bookmark;
  const href =
    grouping.type === "series"
      ? ROUTES.LIBRARY_SERIES.replace(":groupingId", grouping.id)
      : ROUTES.LIBRARY_COLLECTION.replace(":groupingId", grouping.id);

  return (
    <Link
      to={href}
      className="group flex flex-col gap-2 rounded-xl focus-visible:ring-2 focus-visible:ring-ring outline-none"
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-xl border border-border/40 elevated-soft bg-muted transition-shadow group-hover:shadow-lg">
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
          {covers.length > 0 ? (
            covers.map((cover, index) => (
              <img
                key={index}
                src={cover}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
            ))
          ) : (
            <div className="col-span-2 row-span-2 flex items-center justify-center">
              <Icon
                strokeWidth={1.5}
                className="size-8 text-muted-foreground/40"
              />
            </div>
          )}
        </div>
        <div className="absolute top-0 right-0 flex items-center justify-center rounded-bl-xl bg-background/95 p-1.5">
          <Icon strokeWidth={1.5} className="size-4 text-foreground" />
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="font-bold text-ui leading-tight text-foreground line-clamp-2">
          {grouping.name}
        </p>
        <p className="text-ui-sm text-muted-foreground">
          {memberBookIds.length} {memberBookIds.length === 1 ? "book" : "books"}
        </p>
      </div>
    </Link>
  );
};
```

- [ ] **Step 2: Implement `ShelvesGrid`**

Create `src/features/library/components/shelves/shelves-grid.tsx`:

```tsx
import type { FC } from "react";
import { Bookmark, Layers, LibraryBig } from "lucide-react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useShelvesScreen } from "../../hooks/use-shelves-screen";
import { GroupingCard } from "./grouping-card";
import type { GroupingWithMeta } from "../../utils/sort-groupings";

function Grid({ items }: { items: GroupingWithMeta[] }) {
  return (
    <div
      className="grid gap-x-4 gap-y-5"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}
    >
      {items.map((item) => (
        <GroupingCard key={item.grouping.id} item={item} />
      ))}
    </div>
  );
}

export const ShelvesGrid: FC = () => {
  const { isLoading, isEmpty, viewMode, merged, series, collections } =
    useShelvesScreen();

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center py-24 text-ui text-muted-foreground"
      >
        Loading your shelves…
      </div>
    );
  }

  if (isEmpty) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LibraryBig />
          </EmptyMedia>
          <EmptyTitle>No shelves yet</EmptyTitle>
          <EmptyDescription>
            Series are detected automatically from a book's metadata as you
            import more of them.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent />
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="flex items-center gap-4 text-ui-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Layers strokeWidth={1.5} className="size-4" /> Series
        </span>
        <span className="flex items-center gap-1.5">
          <Bookmark strokeWidth={1.5} className="size-4" /> Collections
        </span>
      </p>

      {viewMode === "merged" ? (
        <Grid items={merged} />
      ) : (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h2 className="text-ui font-semibold text-foreground">Series</h2>
            <Grid items={series} />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-ui font-semibold text-foreground">
              Collections
            </h2>
            <Grid items={collections} />
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add src/features/library/components/shelves/
git commit -m "feat(library): add Shelves tab grid and grouping card"
```

---

## Task 6: Common `FilterSheet` component — replaces `LibraryFilterSheet`

**Files:**

- Create: `src/features/library/components/filter-sheet.tsx`
- Create: `src/features/library/utils/filter-sections.ts`
- Test: `src/features/library/utils/__tests__/filter-sections.test.ts`
- Modify: `src/app/screens/library/library-author-screen.tsx`
- Delete: `src/features/library/components/library-filter-sheet.tsx`

**Interfaces:**

- Produces:
  ```ts
  export type FilterSheetSection =
    | {
        type: "chips";
        key: string;
        label: string;
        options: { value: string; label: string }[];
        value: string;
        onChange: (value: string) => void;
      }
    | {
        type: "switch";
        key: string;
        label: string;
        checked: boolean;
        onChange: (checked: boolean) => void;
      }
    | {
        type: "select";
        key: string;
        label: string;
        value: string;
        options: { value: string; label: string }[];
        onChange: (value: string) => void;
      };

  export const FilterSheet: FC<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    sections: FilterSheetSection[];
    onReset?: () => void;
    showReset?: boolean;
  }>;

  export function buildSortSection(
    sortBy: SortOption,
    onSortByChange: (v: SortOption) => void,
  ): FilterSheetSection;
  export function buildLibraryFilterSections(
    filters: LibraryFilters,
    onFiltersChange: (f: LibraryFilters) => void,
    languages: string[],
  ): FilterSheetSection[];
  ```

`FilterSheet` is the one bottom sheet every sort/filter surface in this plan renders through — the Books tab, the author screen (migrated here since it's the only pre-existing user of the component being replaced), the Shelves tab (Task 8), and the series detail screen (Task 12). It only knows how to render three section shapes; it has no idea what "Reading Status" or "View" mean. Each screen decides its own `sections` via small pure builders — `buildSortSection`/`buildLibraryFilterSections` cover the book-grid shape shared by the Books tab, author screen, and series screen; the Shelves tab's two sections (sort + view mode) are simple enough to inline directly in Task 8, since nothing else needs that exact pair.

- [ ] **Step 1: Write the failing tests for the section builders**

Create `src/features/library/utils/__tests__/filter-sections.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  buildLibraryFilterSections,
  buildSortSection,
} from "../filter-sections";
import { DEFAULT_LIBRARY_FILTERS } from "../filter-books";

describe("buildSortSection", () => {
  it("builds a chips section wired to the given sort value and setter", () => {
    const onSortByChange = vi.fn();
    const section = buildSortSection("title", onSortByChange);

    expect(section.type).toBe("chips");
    expect(section.value).toBe("title");
    if (section.type === "chips") section.onChange("author");
    expect(onSortByChange).toHaveBeenCalledWith("author");
  });
});

describe("buildLibraryFilterSections", () => {
  it("omits the language section with fewer than 2 languages", () => {
    const sections = buildLibraryFilterSections(
      DEFAULT_LIBRARY_FILTERS,
      vi.fn(),
      ["en"],
    );
    expect(sections.some((s) => s.key === "language")).toBe(false);
  });

  it("includes the language section with 2+ languages", () => {
    const sections = buildLibraryFilterSections(
      DEFAULT_LIBRARY_FILTERS,
      vi.fn(),
      ["en", "fr"],
    );
    const language = sections.find((s) => s.key === "language");
    expect(language?.type).toBe("select");
  });

  it("wires the hideFinished switch section to the current filter value", () => {
    const sections = buildLibraryFilterSections(
      { ...DEFAULT_LIBRARY_FILTERS, hideFinished: false },
      vi.fn(),
      [],
    );
    const hideFinished = sections.find((s) => s.key === "hideFinished");
    expect(hideFinished?.type).toBe("switch");
    expect(
      hideFinished && hideFinished.type === "switch" && hideFinished.checked,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run src/features/library/utils/__tests__/filter-sections.test.ts`
Expected: FAIL — `../filter-sections` module not found.

- [ ] **Step 3: Implement `filter-sections.ts`**

Create `src/features/library/utils/filter-sections.ts` — the option lists move here from the old `library-filter-sheet.tsx`:

```ts
import type { FilterSheetSection } from "../components/filter-sheet";
import type { LengthBucket, LibraryFilters } from "./filter-books";
import type { ReadingStatus } from "../types/library.types";
import type { SortOption } from "./sort-books";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recentlyImported", label: "Recently Imported" },
  { value: "recentlyOpened", label: "Recently Opened" },
  { value: "title", label: "Title (A–Z)" },
  { value: "author", label: "Author" },
  { value: "progress", label: "Reading Progress" },
  { value: "status", label: "Reading Status" },
];

const STATUS_OPTIONS: { value: ReadingStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "reading", label: "Reading" },
  { value: "finished", label: "Finished" },
];

const LENGTH_OPTIONS: { value: LengthBucket | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "short", label: "Short Reads" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
  { value: "epic", label: "Epic" },
];

export function buildSortSection(
  sortBy: SortOption,
  onSortByChange: (value: SortOption) => void,
): FilterSheetSection {
  return {
    type: "chips",
    key: "sort",
    label: "Sort By",
    options: SORT_OPTIONS,
    value: sortBy,
    onChange: (value) => onSortByChange(value as SortOption),
  };
}

/**
 * The filter half shared by every book-grid screen: Books tab, author
 * screen, and the series screen (Task 12) — the only difference between
 * them is whether buildSortSection's chip group is prepended, since a
 * series's order is fixed and never user-sortable.
 */
export function buildLibraryFilterSections(
  filters: LibraryFilters,
  onFiltersChange: (filters: LibraryFilters) => void,
  languages: string[],
): FilterSheetSection[] {
  const sections: FilterSheetSection[] = [
    {
      type: "chips",
      key: "status",
      label: "Reading Status",
      options: STATUS_OPTIONS,
      value: filters.status,
      onChange: (value) =>
        onFiltersChange({ ...filters, status: value as ReadingStatus | "all" }),
    },
    {
      type: "switch",
      key: "hideFinished",
      label: "Hide Finished Books",
      checked: filters.hideFinished,
      onChange: (checked) =>
        onFiltersChange({ ...filters, hideFinished: checked }),
    },
    {
      type: "chips",
      key: "length",
      label: "Book Length",
      options: LENGTH_OPTIONS,
      value: filters.length,
      onChange: (value) =>
        onFiltersChange({ ...filters, length: value as LengthBucket | "all" }),
    },
  ];

  if (languages.length > 1) {
    sections.push({
      type: "select",
      key: "language",
      label: "Language",
      value: filters.language,
      onChange: (value) => onFiltersChange({ ...filters, language: value }),
      options: [
        { value: "all", label: "All" },
        ...languages.map((language) => ({ value: language, label: language })),
      ],
    });
  }

  return sections;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:run src/features/library/utils/__tests__/filter-sections.test.ts`
Expected: PASS

- [ ] **Step 5: Implement the generic `FilterSheet`**

Create `src/features/library/components/filter-sheet.tsx`:

```tsx
import type { FC } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface ChipOption {
  value: string;
  label: string;
}

export type FilterSheetSection =
  | {
      type: "chips";
      key: string;
      label: string;
      options: ChipOption[];
      value: string;
      onChange: (value: string) => void;
    }
  | {
      type: "switch";
      key: string;
      label: string;
      checked: boolean;
      onChange: (checked: boolean) => void;
    }
  | {
      type: "select";
      key: string;
      label: string;
      value: string;
      options: ChipOption[];
      onChange: (value: string) => void;
    };

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  sections: FilterSheetSection[];
  onReset?: () => void;
  showReset?: boolean;
}

/**
 * One bottom sheet shape shared by every screen that lets the user sort
 * and/or filter a list — the book grid (Books tab, author screen), the
 * Shelves tab (sort + view mode only), and the series detail screen
 * (filters only, no sort — series order is fixed). Each caller passes the
 * `sections` it needs; this component only knows how to render three
 * section shapes (chip group, switch, select), never what any of them mean.
 */
export const FilterSheet: FC<FilterSheetProps> = ({
  open,
  onOpenChange,
  title,
  sections,
  onReset,
  showReset,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85dvh] flex-col rounded-t-3xl border-t bg-card p-0"
        showCloseButton={false}
      >
        <SheetHeader className="gap-4 border-b border-border px-6 pt-3 pb-5">
          <div className="mx-auto h-1 w-16 rounded-full bg-border" />
          <SheetTitle className="text-center">{title}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="flex flex-col gap-6 px-6 py-5">
            {sections.map((section) => {
              if (section.type === "chips") {
                return (
                  <div key={section.key} className="flex flex-col gap-2">
                    <p className="text-meta uppercase tracking-[0.08em] text-muted-foreground">
                      {section.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {section.options.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={
                            section.value === option.value
                              ? "secondary"
                              : "outline"
                          }
                          size="sm"
                          aria-pressed={section.value === option.value}
                          onClick={() => section.onChange(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              }

              if (section.type === "switch") {
                return (
                  <div
                    key={section.key}
                    className="flex items-center justify-between"
                  >
                    <label
                      htmlFor={`filter-sheet-${section.key}`}
                      className="text-meta uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      {section.label}
                    </label>
                    <Switch
                      id={`filter-sheet-${section.key}`}
                      checked={section.checked}
                      onCheckedChange={section.onChange}
                    />
                  </div>
                );
              }

              return (
                <div key={section.key} className="flex flex-col gap-2">
                  <label
                    htmlFor={`filter-sheet-${section.key}`}
                    className="text-meta uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    {section.label}
                  </label>
                  <select
                    id={`filter-sheet-${section.key}`}
                    className="input-folio text-ui text-foreground py-2"
                    value={section.value}
                    onChange={(e) => section.onChange(e.target.value)}
                  >
                    {section.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}

            {showReset && onReset && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={onReset}
              >
                Clear filters
              </Button>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
```

- [ ] **Step 6: Migrate `library-author-screen.tsx` off `LibraryFilterSheet`**

`LibraryAuthorScreen` is the only screen already shipped that uses `LibraryFilterSheet` — leaving it on the old component while everything new uses `FilterSheet` would mean two competing sheet implementations in the codebase. Replace its import and JSX in `src/app/screens/library/library-author-screen.tsx`:

```tsx
import type { FC } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { ROUTES } from "@/utils/routes";
import { Button } from "@/components/ui/button";
import { BookGrid } from "@/features/library/components/book-grid";
import { FilterSheet } from "@/features/library/components/filter-sheet";
import { SortFilterButton } from "@/features/library/components/sort-filter-button";
import { useAuthorScreen } from "@/features/library/hooks/use-author-screen";
import {
  buildLibraryFilterSections,
  buildSortSection,
} from "@/features/library/utils/filter-sections";

export const LibraryAuthorScreen: FC = () => {
  const {
    author,
    isLoading,
    error,
    books,
    isFiltering,
    filterOpen,
    setFilterOpen,
    sortBy,
    setSortBy,
    filters,
    setFilters,
    resetFilters,
    languages,
  } = useAuthorScreen();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="folio-header sticky top-0 z-50 flex items-center gap-1 px-5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to library"
          render={<Link to={ROUTES.LIBRARY} />}
        >
          <ChevronLeft strokeWidth={1.5} className="size-6" />
        </Button>
        <span className="section-title font-semibold text-foreground mr-auto truncate">
          {author}
        </span>
        <SortFilterButton
          isFiltering={isFiltering}
          onClick={() => setFilterOpen(true)}
        />
      </header>

      <main className="flex-1 px-4 pt-5 pb-10">
        <BookGrid
          isLoading={isLoading}
          isSearch={isFiltering}
          error={error}
          books={books}
          hideMoreByAuthor
        />
      </main>

      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Sort & Filter"
        sections={[
          buildSortSection(sortBy, setSortBy),
          ...buildLibraryFilterSections(filters, setFilters, languages),
        ]}
        onReset={resetFilters}
        showReset={isFiltering}
      />
    </div>
  );
};
```

- [ ] **Step 7: Delete the old `library-filter-sheet.tsx`**

```bash
rm src/features/library/components/library-filter-sheet.tsx
```

- [ ] **Step 8: Run the section-builder tests to confirm nothing broke**

Run: `pnpm test:run src/features/library/utils/__tests__/filter-sections.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/features/library/components/filter-sheet.tsx src/features/library/utils/filter-sections.ts src/features/library/utils/__tests__/filter-sections.test.ts src/app/screens/library/library-author-screen.tsx
git rm src/features/library/components/library-filter-sheet.tsx
git commit -m "feat(library): add a common FilterSheet component, migrate the author screen off LibraryFilterSheet"
```

---

## Task 7: `ROUTES.LIBRARY_SHELVES` + Shelves route wiring

**Files:**

- Modify: `src/utils/routes.ts`
- Modify: `src/app/router.tsx`

**Interfaces:**

- Produces: `ROUTES.LIBRARY_SHELVES = "/library/shelves"`.

Only the Shelves tab route is wired here — `ROUTES.LIBRARY_SERIES` already exists as a constant (Day 1) and its route + real screen land together in Task 12, with no placeholder screen in between.

- [ ] **Step 1: Add the route constant**

In `src/utils/routes.ts`:

```ts
export const ROUTES = {
  LIBRARY: "/library",
  LIBRARY_SHELVES: "/library/shelves",
  LIBRARY_AUTHOR: "/library/author/:author",
  LIBRARY_SERIES: "/library/series/:groupingId",
  LIBRARY_COLLECTION: "/library/collection/:groupingId",
  READER: "/reader/:bookId",
  SEARCH: "/search",
  SETTINGS: "/settings",
};
```

- [ ] **Step 2: Wire the Shelves route in `router.tsx`**

In `src/app/router.tsx`, add the Shelves route next to the existing library route:

```tsx
      <Route path={ROUTES.LIBRARY} element={<LibraryScreen />} />
      <Route path={ROUTES.LIBRARY_SHELVES} element={<LibraryScreen />} />
      <Route path={ROUTES.LIBRARY_AUTHOR} element={<LibraryAuthorScreen />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/routes.ts src/app/router.tsx
git commit -m "feat(routing): add LIBRARY_SHELVES route"
```

---

## Task 8: `library-screen.tsx` — tab bar; one `FilterSheet` serves both tabs

**Files:**

- Modify: `src/app/screens/library/library-screen.tsx`
- Test: `src/app/screens/library/__tests__/library-screen.test.tsx`

**Interfaces:**

- Consumes: `ROUTES.LIBRARY_SHELVES` (Task 7), `<ShelvesGrid />` (Task 5), `<FilterSheet />` + `buildSortSection`/`buildLibraryFilterSections` (Task 6), `shelvesStore` (Task 3), `useLocation` from `react-router-dom`.
- The header's `SortFilterButton` stays mounted on both tabs and always opens the same `filterOpen` state (from `useLibraryScreen()`, unchanged) — only _which_ `sections`/`title` the one `<FilterSheet>` renders changes, based on `isShelves`. On Shelves, `sections` is built inline (two chip groups: sort, view mode) reading/writing `shelvesStore` directly — `ShelvesGrid` already calls `useShelvesScreen()` separately for its own grid data, and both read the same persisted store, so the header and the grid stay in sync with no prop drilling between them.

- [ ] **Step 1: Write the failing routing test**

Create `src/app/screens/library/__tests__/library-screen.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LibraryScreen } from "../library-screen";
import { ROUTES } from "@/utils/routes";
import { libraryStore } from "@/features/library/store/library-store";
import { shelvesStore } from "@/features/library/store/shelves-store";

vi.mock("@/features/library/actions/load-library", () => ({
  loadLibrary: vi.fn(async () => {}),
}));
vi.mock("@/services/storage/groupings", () => ({
  listGroupings: vi.fn(async () => []),
  getMembersForGrouping: vi.fn(async () => []),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.LIBRARY} element={<LibraryScreen />} />
        <Route path={ROUTES.LIBRARY_SHELVES} element={<LibraryScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LibraryScreen tabs", () => {
  beforeEach(() => {
    libraryStore.setState({ books: [], isLoading: false, error: null });
    shelvesStore.setState({ sortBy: "alphabetical", viewMode: "merged" });
  });

  it("shows the Books grid and marks Books active at /library", () => {
    renderAt(ROUTES.LIBRARY);

    expect(screen.getByRole("link", { name: "Books" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Shelves" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("shows the Shelves content and marks Shelves active at /library/shelves", async () => {
    renderAt(ROUTES.LIBRARY_SHELVES);

    expect(screen.getByRole("link", { name: "Shelves" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(await screen.findByText("No shelves yet")).toBeInTheDocument();
  });

  it("opens the book-grid filter sections from the Books tab", async () => {
    renderAt(ROUTES.LIBRARY);

    screen.getByRole("button", { name: "Sort and filter" }).click();

    expect(await screen.findByText("Reading Status")).toBeInTheDocument();
  });

  it("opens the Shelves sort/view sections from the Shelves tab", async () => {
    renderAt(ROUTES.LIBRARY_SHELVES);
    await screen.findByText("No shelves yet");

    screen.getByRole("button", { name: "Sort and filter" }).click();

    expect(await screen.findByText("View")).toBeInTheDocument();
    expect(screen.queryByText("Reading Status")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run src/app/screens/library/__tests__/library-screen.test.tsx`
Expected: FAIL — no "Books"/"Shelves" tab links exist yet, and there's only one sheet shape.

- [ ] **Step 3: Add the tab bar and per-tab `FilterSheet` sections to `library-screen.tsx`**

In `src/app/screens/library/library-screen.tsx`, add imports:

```tsx
import { useLocation } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { shelvesStore } from "@/features/library/store/shelves-store";
import { ShelvesGrid } from "@/features/library/components/shelves/shelves-grid";
import {
  FilterSheet,
  type FilterSheetSection,
} from "@/features/library/components/filter-sheet";
import {
  buildLibraryFilterSections,
  buildSortSection,
} from "@/features/library/utils/filter-sections";
import type {
  ShelvesSortOption,
  ShelvesViewMode,
} from "@/features/library/utils/sort-groupings";
```

Replace the existing `import { LibraryFilterSheet } from "@/features/library/components/library-filter-sheet";` line (it no longer exists) — there is no such import in this file today since `LibraryFilterSheet` is imported directly by name already; just swap that import for `FilterSheet` above.

Add local constants (single caller — no shared builder needed for these, unlike the book-grid sections):

```tsx
const SHELVES_SORT_OPTIONS: { value: ShelvesSortOption; label: string }[] = [
  { value: "alphabetical", label: "A–Z" },
  { value: "createdAt", label: "Created" },
  { value: "updatedAt", label: "Updated" },
];

const VIEW_MODE_OPTIONS: { value: ShelvesViewMode; label: string }[] = [
  { value: "merged", label: "Merged" },
  { value: "grouped", label: "Grouped" },
];
```

Inside the component, before the returned JSX:

```tsx
const location = useLocation();
const isShelves = location.pathname === ROUTES.LIBRARY_SHELVES;

const {
  sortBy: shelvesSortBy,
  viewMode: shelvesViewMode,
  setSortBy: setShelvesSortBy,
  setViewMode: setShelvesViewMode,
} = shelvesStore(
  useShallow((state) => ({
    sortBy: state.sortBy,
    viewMode: state.viewMode,
    setSortBy: state.setSortBy,
    setViewMode: state.setViewMode,
  })),
);

const shelvesSections: FilterSheetSection[] = [
  {
    type: "chips",
    key: "sort",
    label: "Sort By",
    options: SHELVES_SORT_OPTIONS,
    value: shelvesSortBy,
    onChange: (value) => setShelvesSortBy(value as ShelvesSortOption),
  },
  {
    type: "chips",
    key: "view",
    label: "View",
    options: VIEW_MODE_OPTIONS,
    value: shelvesViewMode,
    onChange: (value) => setShelvesViewMode(value as ShelvesViewMode),
  },
];

const bookSections: FilterSheetSection[] = [
  buildSortSection(sortBy, setSortBy),
  ...buildLibraryFilterSections(filters, setFilters, languages),
];
```

Replace the `<SortFilterButton>` in the header — it stays mounted on both tabs, but its dot indicator branches on `isShelves` (its `onClick` is unchanged — `() => setFilterOpen(true)` already works for both, since only one `<FilterSheet>` now exists):

```tsx
<SortFilterButton
  isFiltering={
    isShelves
      ? shelvesSortBy !== "alphabetical" || shelvesViewMode !== "merged"
      : isFiltering
  }
  onClick={() => setFilterOpen(true)}
/>
```

Replace the `<h1>Your Personal Collection</h1>` and the `<BookGrid>` block in `<main>` with:

```tsx
<nav className="mb-5 flex gap-2" aria-label="Library sections">
  <Link
    to={ROUTES.LIBRARY}
    aria-current={!isShelves ? "page" : undefined}
    className={`text-ui font-semibold px-3 py-1.5 rounded-full transition-colors ${
      !isShelves
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:text-foreground"
    }`}
  >
    Books
  </Link>
  <Link
    to={ROUTES.LIBRARY_SHELVES}
    aria-current={isShelves ? "page" : undefined}
    className={`text-ui font-semibold px-3 py-1.5 rounded-full transition-colors ${
      isShelves
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:text-foreground"
    }`}
  >
    Shelves
  </Link>
</nav>;

{
  isShelves ? (
    <ShelvesGrid />
  ) : (
    <BookGrid
      isLoading={isLoading}
      isSearch={isFiltering}
      error={error}
      books={visibleBooks}
    />
  );
}
```

Replace the existing `<LibraryFilterSheet ...>` at the bottom with the single, tab-aware `<FilterSheet>`:

```tsx
<FilterSheet
  open={filterOpen}
  onOpenChange={setFilterOpen}
  title={isShelves ? "Sort & View" : "Sort & Filter"}
  sections={isShelves ? shelvesSections : bookSections}
  onReset={isShelves ? undefined : resetFilters}
  showReset={!isShelves && isFiltering}
/>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:run src/app/screens/library/__tests__/library-screen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/screens/library/library-screen.tsx src/app/screens/library/__tests__/library-screen.test.tsx
git commit -m "feat(library): add Books/Shelves tab bar; one FilterSheet serves both tabs"
```

---

## Task 9: `use-book-card.ts` — "View Series" entry point

**Files:**

- Modify: `src/features/library/hooks/use-book-card.ts`
- Test: `src/features/library/hooks/__tests__/use-book-card.test.ts`

**Interfaces:**

- Consumes: `book.seriesName`, `book.seriesGroupingId` (Task 1), `libraryStore` (books already loaded).
- Produces: `hasSeriesLink: boolean`, `openViewSeries: () => void`, and a `"view-series"` entry in `menuItems` mirroring the existing `"more-by-author"` entry.

- [ ] **Step 1: Write the failing test**

Create `src/features/library/hooks/__tests__/use-book-card.test.ts`:

```ts
import { renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useBookCard } from "../use-book-card";
import { libraryStore } from "../../store/library-store";
import type { BookWithProgress } from "../../types/library.types";

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

function makeBook(overrides: Partial<BookWithProgress> = {}): BookWithProgress {
  return {
    id: "b1",
    title: "Foundation",
    createdAt: 0,
    fileHash: "h1",
    status: "unread",
    seriesName: "Foundation Series",
    seriesGroupingId: "g1",
    ...overrides,
  };
}

describe("useBookCard series link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hasSeriesLink is false when fewer than 2 books share the series", () => {
    libraryStore.setState({
      books: [makeBook()],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useBookCard(makeBook()), { wrapper });

    expect(result.current.hasSeriesLink).toBe(false);
  });

  it("hasSeriesLink is true when 2+ books share the series", () => {
    libraryStore.setState({
      books: [
        makeBook({ id: "b1" }),
        makeBook({ id: "b2", title: "Foundation and Empire" }),
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useBookCard(makeBook()), { wrapper });

    expect(result.current.hasSeriesLink).toBe(true);
    expect(
      result.current.menuItems.some((item) => item.id === "view-series"),
    ).toBe(true);
  });

  it("hasSeriesLink is false when the book has no seriesName", () => {
    libraryStore.setState({
      books: [
        makeBook({ id: "b1", seriesName: undefined, seriesGroupingId: undefined }),
        makeBook({ id: "b2", seriesName: undefined, seriesGroupingId: undefined }),
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(
      () =>
        useBookCard(
          makeBook({ seriesName: undefined, seriesGroupingId: undefined }),
        ),
      { wrapper },
    );

    expect(result.current.hasSeriesLink).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run src/features/library/hooks/__tests__/use-book-card.test.ts`
Expected: FAIL — `hasSeriesLink` is `undefined`, no `"view-series"` menu item.

- [ ] **Step 3: Add series-link support to `use-book-card.ts`**

`ROUTES` is already imported in this file. Update the destructure of `book`:

```ts
const {
  id,
  author,
  isFinished,
  isReading,
  progress,
  seriesName,
  seriesGroupingId,
} = book;
```

Add alongside the existing `booksByAuthorCount` selector:

```ts
const booksInSeriesCount = libraryStore((state) =>
  seriesName
    ? state.books.filter((b) => b.seriesName === seriesName).length
    : 0,
);
```

After `const hasMoreByAuthor = ...`:

```ts
const hasSeriesLink = booksInSeriesCount > 1 && !!seriesGroupingId;
```

After `const openMoreByAuthor = ...`:

```ts
const openViewSeries = () =>
  navigate(ROUTES.LIBRARY_SERIES.replace(":groupingId", seriesGroupingId!));
```

In the `menuItems` array, after the `hasMoreByAuthor` conditional block:

```ts
    ...(hasSeriesLink
      ? ([
          {
            type: "item",
            id: "view-series",
            label: "View Series",
            onClick: openViewSeries,
          },
        ] as const)
      : []),
```

And add `hasSeriesLink`, `openViewSeries` to the returned object.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:run src/features/library/hooks/__tests__/use-book-card.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/library/hooks/use-book-card.ts src/features/library/hooks/__tests__/use-book-card.test.ts
git commit -m "feat(library): add View Series entry to the book card menu"
```

---

## Task 10: `seriesFilterStore`

**Files:**

- Modify: `src/features/library/store/filter-store.ts`

**Interfaces:**

- Produces: `seriesFilterStore` — a `createFilterStore("series-filter-store")` instance, same shape as `libraryFilterStore`/`authorFilterStore`.

- [ ] **Step 1: Add the store instance**

In `src/features/library/store/filter-store.ts`, after the existing exports:

```ts
export const libraryFilterStore = createFilterStore("library-filter-store");
export const authorFilterStore = createFilterStore("author-filter-store");
export const seriesFilterStore = createFilterStore("series-filter-store");
```

- [ ] **Step 2: Commit**

```bash
git add src/features/library/store/filter-store.ts
git commit -m "feat(library): add seriesFilterStore instance"
```

---

## Task 11: `use-series-detail-screen.ts`

**Files:**

- Create: `src/features/library/hooks/use-series-detail-screen.ts`
- Test: `src/features/library/hooks/__tests__/use-series-detail-screen.test.ts`

**Interfaces:**

- Consumes: `getGrouping`, `getMembersForGrouping` (from `@/services/storage/groupings`), `isCollection` (existing), `libraryStore`, `seriesFilterStore` (Task 10), `useLibraryFilters` (existing), `filterBooksByCriteria`, `hasActiveFilters` (existing, `filter-books.ts`), `enrichBookWithProgress` (existing).
- Produces:

  ```ts
  export function useSeriesDetailScreen(): {
    groupingName: string | null;
    redirectToShelves: boolean;
    isLoading: boolean;
    error: string | null;
    books: BookWithProgress[]; // ordered by GroupingMember.order, title tiebreak — never re-sortable
    isFiltering: boolean;
    filterOpen: boolean;
    setFilterOpen: (v: boolean) => void;
    filters: LibraryFilters;
    setFilters: (f: LibraryFilters) => void;
    resetFilters: () => void;
    languages: string[];
  };
  ```

- [ ] **Step 1: Write the failing test**

Create `src/features/library/hooks/__tests__/use-series-detail-screen.test.ts`:

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useSeriesDetailScreen } from "../use-series-detail-screen";
import { libraryStore } from "../../store/library-store";
import { ROUTES } from "@/utils/routes";
import type { StoredBook } from "@/services/storage/storage-types";

vi.mock("@/services/storage/groupings", () => ({
  getGrouping: vi.fn(async (id: string) =>
    id === "g1"
      ? { id: "g1", type: "series", name: "Foundation Series", createdAt: 1, updatedAt: 1 }
      : id === "g2"
        ? { id: "g2", type: "collection", name: "Favorites", createdAt: 1, updatedAt: 1 }
        : undefined,
  ),
  getMembersForGrouping: vi.fn(async () => [
    { groupingId: "g1", bookId: "b2", order: 2 },
    { groupingId: "g1", bookId: "b1", order: 1 },
  ]),
  isCollection: vi.fn((g: { type: string }) => g.type === "collection"),
}));

function renderAt(groupingId: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/library/series/${groupingId}`]}>
      <Routes>
        <Route path={ROUTES.LIBRARY_SERIES} element={<>{children}</>} />
      </Routes>
    </MemoryRouter>
  );
  return renderHook(() => useSeriesDetailScreen(), { wrapper });
}

describe("useSeriesDetailScreen", () => {
  beforeEach(() => {
    libraryStore.setState({
      books: [
        { id: "b1", title: "Foundation", createdAt: 1, fileHash: "h1" } as StoredBook,
        { id: "b2", title: "Foundation and Empire", createdAt: 2, fileHash: "h2" } as StoredBook,
      ],
      isLoading: false,
      error: null,
    });
  });

  it("orders books by GroupingMember.order regardless of import order", async () => {
    const { result } = renderAt("g1");

    await waitFor(() => expect(result.current.groupingName).toBe("Foundation Series"));
    expect(result.current.books.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(result.current.redirectToShelves).toBe(false);
  });

  it("defaults hideFinished to false for the series screen", async () => {
    const { result } = renderAt("g1");
    await waitFor(() => expect(result.current.groupingName).toBe("Foundation Series"));

    expect(result.current.filters.hideFinished).toBe(false);
  });

  it("flags redirectToShelves for a collection-type grouping id", async () => {
    const { result } = renderAt("g2");

    await waitFor(() => expect(result.current.redirectToShelves).toBe(true));
  });

  it("flags redirectToShelves for an unresolvable grouping id", async () => {
    const { result } = renderAt("missing");

    await waitFor(() => expect(result.current.redirectToShelves).toBe(true));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run src/features/library/hooks/__tests__/use-series-detail-screen.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `src/features/library/hooks/use-series-detail-screen.ts`:

```ts
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import {
  getGrouping,
  getMembersForGrouping,
  isCollection,
} from "@/services/storage/groupings";
import type {
  Grouping,
  GroupingMember,
} from "@/services/storage/storage-types";
import { libraryStore } from "../store/library-store";
import { seriesFilterStore } from "../store/filter-store";
import { enrichBookWithProgress } from "../utils/derive-book-status";
import { filterBooksByCriteria, hasActiveFilters } from "../utils/filter-books";
import { useLibraryFilters } from "./use-library-filters";

/**
 * Books by a single series, reached from a book card's "View Series"
 * action. Always ordered by GroupingMember.order (title as tiebreak) —
 * never user-sortable, unlike the author screen: a series reads as one
 * ordered sequence. hideFinished defaults to false here specifically (a
 * series is a small curated list, not a big library needing decluttering)
 * via a per-instance override, not a change to DEFAULT_LIBRARY_FILTERS.
 */
export function useSeriesDetailScreen() {
  const { groupingId } = useParams<{ groupingId: string }>();
  const { books } = libraryStore();

  const [grouping, setGrouping] = useState<Grouping | null | undefined>(
    undefined,
  );
  const [members, setMembers] = useState<GroupingMember[]>([]);

  useEffect(() => {
    if (!groupingId) return;
    let cancelled = false;

    void Promise.all([
      getGrouping(groupingId),
      getMembersForGrouping(groupingId),
    ]).then(([foundGrouping, foundMembers]) => {
      if (cancelled) return;
      setGrouping(foundGrouping ?? null);
      setMembers(foundMembers);
    });

    return () => {
      cancelled = true;
    };
  }, [groupingId]);

  const orderById = useMemo(
    () => new Map(members.map((member) => [member.bookId, member.order])),
    [members],
  );

  const enriched = useMemo(() => books.map(enrichBookWithProgress), [books]);

  const seriesBooks = useMemo(() => {
    const inSeries = enriched.filter((book) => orderById.has(book.id));
    // Nulls (missing order) sort last; ties (including two nulls) fall
    // back to title. `?? Infinity` does the "nulls last" half in one
    // expression instead of three separate null-check branches.
    return [...inSeries].sort(
      (a, b) =>
        (orderById.get(a.id) ?? Infinity) - (orderById.get(b.id) ?? Infinity) ||
        a.title.localeCompare(b.title),
    );
  }, [enriched, orderById]);

  const {
    filterOpen,
    setFilterOpen,
    filters,
    setFilters,
    resetFilters,
    languages,
    isFiltering,
  } = useLibraryFilters(seriesBooks, seriesFilterStore);

  // Per-instance default: series screens declutter differently from the
  // main library, so a fresh (never-touched) filter state should show
  // finished books rather than hide them, without changing the shared
  // DEFAULT_LIBRARY_FILTERS every other screen also uses. hasActiveFilters
  // already knows what "untouched" means, so it's reused here rather than
  // re-deriving the same comparison field by field.
  const effectiveFilters = !hasActiveFilters(filters)
    ? { ...filters, hideFinished: false }
    : filters;

  const visibleBooks = filterBooksByCriteria(seriesBooks, effectiveFilters);

  return {
    groupingName: grouping?.name ?? null,
    redirectToShelves:
      grouping === null || (grouping ? isCollection(grouping) : false),
    isLoading: grouping === undefined,
    error: null,
    books: visibleBooks,
    isFiltering,
    filterOpen,
    setFilterOpen,
    filters: effectiveFilters,
    setFilters,
    resetFilters,
    languages,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:run src/features/library/hooks/__tests__/use-series-detail-screen.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/library/hooks/use-series-detail-screen.ts src/features/library/hooks/__tests__/use-series-detail-screen.test.ts
git commit -m "feat(library): add use-series-detail-screen hook"
```

---

## Task 12: `LibrarySeriesScreen` — screen + router wiring together

**Files:**

- Create: `src/app/screens/library/library-series-screen.tsx`
- Modify: `src/app/router.tsx`

**Interfaces:**

- Consumes: `useSeriesDetailScreen()` (Task 11), `BookGrid`, `<FilterSheet />` + `buildLibraryFilterSections` (Task 6 — no `buildSortSection`, since series order is fixed and never user-sortable), `SortFilterButton` (all existing), `ROUTES.LIBRARY_SERIES` (already exists as a constant since Day 1).

No placeholder screen was created earlier (Task 7 wired only the Shelves route) — the screen and its route land in the same commit here, so there's no intermediate state where the route points at an empty stand-in.

- [ ] **Step 1: Implement the screen**

Create `src/app/screens/library/library-series-screen.tsx`:

```tsx
import type { FC } from "react";
import { Link, Navigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { ROUTES } from "@/utils/routes";
import { Button } from "@/components/ui/button";
import { BookGrid } from "@/features/library/components/book-grid";
import { FilterSheet } from "@/features/library/components/filter-sheet";
import { SortFilterButton } from "@/features/library/components/sort-filter-button";
import { useSeriesDetailScreen } from "@/features/library/hooks/use-series-detail-screen";
import { buildLibraryFilterSections } from "@/features/library/utils/filter-sections";

export const LibrarySeriesScreen: FC = () => {
  const {
    groupingName,
    redirectToShelves,
    isLoading,
    error,
    books,
    isFiltering,
    filterOpen,
    setFilterOpen,
    filters,
    setFilters,
    resetFilters,
    languages,
  } = useSeriesDetailScreen();

  if (redirectToShelves) {
    return <Navigate to={ROUTES.LIBRARY_SHELVES} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="folio-header sticky top-0 z-50 flex items-center gap-1 px-5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to library"
          render={<Link to={ROUTES.LIBRARY_SHELVES} />}
        >
          <ChevronLeft strokeWidth={1.5} className="size-6" />
        </Button>
        <span className="section-title font-semibold text-foreground mr-auto truncate">
          {groupingName}
        </span>
        <SortFilterButton
          isFiltering={isFiltering}
          onClick={() => setFilterOpen(true)}
        />
      </header>

      <main className="flex-1 px-4 pt-5 pb-10">
        <BookGrid
          isLoading={isLoading}
          isSearch={isFiltering}
          error={error}
          books={books}
        />
      </main>

      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Filter"
        sections={buildLibraryFilterSections(filters, setFilters, languages)}
        onReset={resetFilters}
        showReset={isFiltering}
      />
    </div>
  );
};
```

No sort chip group is passed here — `buildLibraryFilterSections` alone (status, hide-finished, length, language), unlike the Books tab and author screen which prepend `buildSortSection`. The series screen's ordering is always `GroupingMember.order`, never user-driven, so there's simply no sort section to render — no inert prop wiring needed the way a `showSort={false}` toggle would have required.

- [ ] **Step 2: Wire the route in `router.tsx`**

In `src/app/router.tsx`, add the import:

```tsx
import { LibrarySeriesScreen } from "./screens/library/library-series-screen";
```

And the route, next to the existing author route:

```tsx
      <Route path={ROUTES.LIBRARY_AUTHOR} element={<LibraryAuthorScreen />} />
      <Route path={ROUTES.LIBRARY_SERIES} element={<LibrarySeriesScreen />} />
```

- [ ] **Step 3: Run the full test suite touched by this plan to verify nothing regressed**

Run: `pnpm test:run src/features/library/hooks/__tests__/use-series-detail-screen.test.ts src/app/screens/library/__tests__/library-screen.test.tsx src/features/library/utils/__tests__/filter-sections.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/screens/library/library-series-screen.tsx src/app/router.tsx
git commit -m "feat(library): add the series detail screen and its route"
```

---

## Self-Review Notes

- **Spec coverage:** Decisions 1–7 each map to a task (tabs → Task 8; merged grid → Tasks 4/5; `updatedAt` → Task 1; shelves-store → Task 3; series screen → Tasks 11/12; "View Series" entry → Task 9; `seriesGroupingId` at import → Task 1). Empty states (Task 5/12's `Navigate`) and testing section items (groupings, import-book, sort-groupings, use-book-card, use-shelves-screen/use-series-detail-screen, library-screen routing) each have a corresponding task.
- **Non-goals honored:** no collection CRUD actions, no `updatedAt` mutation wiring beyond creation, no Collections-specific empty copy, no `filter-store.ts` factory changes (only a new instance), no URL-encoded Shelves sort/view state.
- **Type consistency:** `ShelvesSortOption`/`ShelvesViewMode` defined once in `sort-groupings.ts` (Task 2) and imported everywhere else (`shelves-store.ts`, `use-shelves-screen.ts`, `library-screen.tsx`) rather than redeclared. `GroupingWithMeta` (carrying `covers`) flows from Task 2 through Tasks 4/5 unchanged. `FilterSheetSection` (Task 6) is the one section-shape union every sort/filter surface produces and `FilterSheet` consumes.
- **Common `FilterSheet` (this revision):** replaces the earlier design of one book-grid-specific `LibraryFilterSheet` (with a `showSort` toggle) plus a separate `ShelvesSortSheet`, with a single generic, `sections`-driven `FilterSheet` used by all four sort/filter surfaces — Books tab, author screen (migrated in Task 6, the only pre-existing consumer), Shelves tab, and the series screen. `buildSortSection`/`buildLibraryFilterSections` (Task 6) capture the book-grid shape shared by three of those four; the Shelves tab's two sections are simple enough to inline once, in Task 8, since nothing else needs that exact pair.
- **Post-audit simplifications retained:** `upsertSeriesMembership` stays a single function (no `resolveOrCreateSeriesGrouping` split) and now returns the resolved id; `splitByType` always returns all three lists instead of branching on a `viewMode` union; cover art is computed once in `sort-groupings.ts` as `GroupingWithMeta.covers` instead of a per-render hook closure; `use-series-detail-screen.ts` reuses `hasActiveFilters` instead of a hand-rolled default-check; the series screen's route and component ship together in one task with no intermediate placeholder file.
