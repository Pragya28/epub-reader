# Sprint 7 Day 1 — Organization Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the storage-layer foundation for Series (auto-detected, read-only) and Collections (user-managed) — schema, OPF metadata parsing, and the series build/delete/backfill lifecycle — with no UI. Screens (Day 4) and collection CRUD actions (Day 3) build on top of this.

**Architecture:** One unified `groupings` table (discriminated by `type: "series" | "collection"`) plus a `groupingMembers` join table, added as Dexie schema v6. A new `services/storage/groupings.ts` module owns all reads/writes against both tables, including an `isCollection()` guard that later action/UI code uses to keep series read-only. `import-book.ts`/`delete-book.ts` get thin wiring calls, mirroring exactly how Sprint 6 wired search-index lifecycle into the same two files. The OPF parser gains Calibre `calibre:series`/`calibre:series_index` extraction, since nothing upstream of the schema can be tested without real series metadata to write.

**Tech Stack:** TypeScript, Dexie (IndexedDB), Vitest, existing `services/epub/`, `services/storage/`, `features/library/actions/` modules.

**Spec:** `superpowers/specs/2026-08-13-collections-series-data-model-design.md`

## Global Constraints

- Package manager is pnpm — don't use npm/yarn.
- `store` in a filename means a Zustand store only — `groupings.ts` is a plain Dexie-access module, not a store, and must not be named as one.
- Don't re-export one module's functions through another for convenience — import each function directly from its defining module.
- Tests are colocated in `__tests__/` next to the code they cover.
- Use real EPUB fixtures via `loadFixture()` (`src/tests/utils/load-fixtures.ts`) — don't hand-construct EPUB blobs. Tests needing specific series metadata use `vi.spyOn(EpubParser.prototype, "parseLibraryBook")` to control the parsed result while still passing a real fixture `File` through `importBook()` (existing fixtures carry no series metadata).
- `resetTestDb()` (from `src/tests/utils/reset-test-db.ts`) must run in `beforeEach` for any test touching Dexie state.
- Series metadata parsing reads Calibre's `calibre:series`/`calibre:series_index` convention only — no EPUB3 `belongs-to-collection` support (spec decision 5).
- `isCollection(grouping)` is the one guard both the (future Day 3) action layer and UI layer must use to keep series read-only — defined here so nothing downstream reinvents the check.

---

### Task 1: OPF parser — Calibre series metadata extraction

**Files:**

- Modify: `src/services/epub/epub-types.ts:25-30` (`ParsedEpubMetadata`)
- Modify: `src/services/epub/parsers/opf-parser.ts:25-46` (`parseMetadata`)
- Test: `src/services/epub/parsers/__tests__/opf-parser.test.ts`

**Interfaces:**

- Consumes: nothing new — extends the existing `parseMetadata`/`ParsedEpubMetadata` the rest of the parser already produces.
- Produces: `ParsedEpubMetadata.seriesName?: string` and `ParsedEpubMetadata.seriesIndex?: number`, consumed by Task 3 (`import-book.ts`) via `EpubParser.parseLibraryBook()`, which already returns `parsed.metadata` unchanged (`src/services/epub/epub-parser.ts:115-116`) — no orchestrator changes needed.

- [ ] **Step 1: Write the failing tests**

Add to `src/services/epub/parsers/__tests__/opf-parser.test.ts`, inside the existing `describe("OpfParser", ...)` block (after the `"extracts description when present"` test):

```ts
it("extracts calibre series metadata when present", () => {
  const xml = `
    <package>
      <metadata>
        <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Foundation</dc:title>
        <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">Isaac Asimov</dc:creator>
        <meta name="calibre:series" content="Foundation Series" />
        <meta name="calibre:series_index" content="2" />
      </metadata>

      <manifest>
        <item
          id="chapter-1"
          href="text/chapter-1.xhtml"
          media-type="application/xhtml+xml"
        />
      </manifest>

      <spine>
        <itemref idref="chapter-1" />
      </spine>
    </package>
  `;

  const result = parser.parse(parseXml(xml));

  expect(result.metadata.seriesName).toBe("Foundation Series");
  expect(result.metadata.seriesIndex).toBe(2);
});

it("leaves series fields undefined when calibre series metadata is absent", () => {
  const xml = `
    <package>
      <metadata>
        <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Test Book</dc:title>
        <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">Test Author</dc:creator>
      </metadata>

      <manifest>
        <item
          id="chapter-1"
          href="text/chapter-1.xhtml"
          media-type="application/xhtml+xml"
        />
      </manifest>

      <spine>
        <itemref idref="chapter-1" />
      </spine>
    </package>
  `;

  const result = parser.parse(parseXml(xml));

  expect(result.metadata.seriesName).toBeUndefined();
  expect(result.metadata.seriesIndex).toBeUndefined();
});

it("treats a non-numeric series_index as absent while keeping the series name", () => {
  const xml = `
    <package>
      <metadata>
        <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Foundation</dc:title>
        <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">Isaac Asimov</dc:creator>
        <meta name="calibre:series" content="Foundation Series" />
        <meta name="calibre:series_index" content="two" />
      </metadata>

      <manifest>
        <item
          id="chapter-1"
          href="text/chapter-1.xhtml"
          media-type="application/xhtml+xml"
        />
      </manifest>

      <spine>
        <itemref idref="chapter-1" />
      </spine>
    </package>
  `;

  const result = parser.parse(parseXml(xml));

  expect(result.metadata.seriesName).toBe("Foundation Series");
  expect(result.metadata.seriesIndex).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run src/services/epub/parsers/__tests__/opf-parser.test.ts`
Expected: FAIL — `result.metadata.seriesName` is `undefined` in the first test (should be `"Foundation Series"`); `ParsedEpubMetadata` has no `seriesName`/`seriesIndex` fields yet, so TypeScript will also flag the test file.

- [ ] **Step 3: Write minimal implementation**

In `src/services/epub/epub-types.ts`, replace the `ParsedEpubMetadata` interface (lines 25-30):

```ts
export interface ParsedEpubMetadata {
  title: string;
  author: string;
  language: string | null;
  description: string | null;
  seriesName?: string;
  seriesIndex?: number;
}
```

In `src/services/epub/parsers/opf-parser.ts`, replace `parseMetadata` (lines 25-46):

```ts
private parseMetadata(opfXml: Document): ParsedEpubMetadata {
  const metadata = this.getDocumentElement(opfXml, [
    "metadata",
    "opf:metadata",
  ]);
  if (!metadata) throw new Error("metadata not found");

  const title =
    this.getTextContent(metadata, ["title", "dc:title"]) ?? "Not Available";
  const author =
    this.getTextContent(metadata, ["creator", "dc:creator"]) ?? "Unknown";
  const language = this.getTextContent(metadata, ["language", "dc:language"]);
  const rawDescription = this.getTextContent(metadata, [
    "description",
    "dc:description",
  ]);
  const description = rawDescription
    ? this.stripHtml(rawDescription)
    : rawDescription;

  const seriesName =
    this.getMetaContent(metadata, "calibre:series") ?? undefined;
  const seriesIndexRaw = this.getMetaContent(metadata, "calibre:series_index");
  const seriesIndex =
    seriesIndexRaw !== null && !Number.isNaN(Number(seriesIndexRaw))
      ? Number(seriesIndexRaw)
      : undefined;

  return { title, author, language, description, seriesName, seriesIndex };
}

/**
 * Reads a generic `<meta name="...">` element's `content` attribute —
 * distinct from `getTextContent`, which only reads named tags' own text.
 * Calibre's series convention (and EPUB2's cover convention, see
 * findCover) is expressed this way rather than as a dedicated tag.
 */
private getMetaContent(metadata: Element, name: string): string | null {
  const meta = metadata.querySelector(`meta[name="${name}"]`);
  const content = meta?.getAttribute("content")?.trim();
  return content ? content : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run src/services/epub/parsers/__tests__/opf-parser.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add src/services/epub/epub-types.ts src/services/epub/parsers/opf-parser.ts src/services/epub/parsers/__tests__/opf-parser.test.ts
git commit -m "feat(epub): parse calibre series metadata from OPF"
```

---

### Task 2: Grouping storage types, v6 schema, and the groupings CRUD module

**Files:**

- Modify: `src/services/storage/storage-types.ts:41-57` (`StoredBook`)
- Modify: `src/services/storage/storage-types.ts` (add `Grouping`, `GroupingMember`)
- Modify: `src/services/storage/db.ts`
- Create: `src/utils/create-grouping-id.ts`
- Create: `src/services/storage/groupings.ts`
- Test: `src/services/storage/__tests__/groupings.test.ts`

**Interfaces:**

- Consumes: `db` from `@/services/storage/db`; `Grouping`, `GroupingMember` from `@/services/storage/storage-types`; `createGroupingId(): string` from `@/utils/create-grouping-id`.
- Produces (all from `@/services/storage/groupings`, consumed by Tasks 3-5):
  - `getGrouping(id: string): Promise<Grouping | undefined>`
  - `listGroupings(type?: "series" | "collection"): Promise<Grouping[]>`
  - `putGrouping(grouping: Grouping): Promise<void>`
  - `deleteGrouping(id: string): Promise<void>`
  - `getMembersForBook(bookId: string): Promise<GroupingMember[]>`
  - `getMembersForGrouping(groupingId: string): Promise<GroupingMember[]>`
  - `addMember(groupingId: string, bookId: string, order?: number | null): Promise<void>`
  - `removeMember(groupingId: string, bookId: string): Promise<void>`
  - `isCollection(grouping: Grouping): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/services/storage/__tests__/groupings.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  addMember,
  deleteGrouping,
  getGrouping,
  getMembersForBook,
  getMembersForGrouping,
  isCollection,
  listGroupings,
  putGrouping,
  removeMember,
} from "../groupings";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import type { Grouping } from "../storage-types";

describe("groupings", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("puts and gets a grouping", async () => {
    const grouping: Grouping = {
      id: "g1",
      type: "collection",
      name: "Favorites",
      createdAt: 1,
    };

    await putGrouping(grouping);

    expect(await getGrouping("g1")).toEqual(grouping);
  });

  it("lists groupings filtered by type", async () => {
    await putGrouping({
      id: "g1",
      type: "collection",
      name: "Favorites",
      createdAt: 1,
    });
    await putGrouping({
      id: "g2",
      type: "series",
      name: "Foundation",
      createdAt: 2,
    });

    const collections = await listGroupings("collection");
    expect(collections).toHaveLength(1);
    expect(collections[0].id).toBe("g1");

    expect(await listGroupings()).toHaveLength(2);
  });

  it("deletes a grouping", async () => {
    await putGrouping({
      id: "g1",
      type: "collection",
      name: "Favorites",
      createdAt: 1,
    });

    await deleteGrouping("g1");

    expect(await getGrouping("g1")).toBeUndefined();
  });

  it("adds and reads membership from both sides", async () => {
    await addMember("g1", "book-1", 2);

    expect(await getMembersForBook("book-1")).toEqual([
      { groupingId: "g1", bookId: "book-1", order: 2 },
    ]);
    expect(await getMembersForGrouping("g1")).toEqual([
      { groupingId: "g1", bookId: "book-1", order: 2 },
    ]);
  });

  it("removes a specific membership without touching others", async () => {
    await addMember("g1", "book-1", null);
    await addMember("g1", "book-2", null);

    await removeMember("g1", "book-1");

    const remaining = await getMembersForGrouping("g1");
    expect(remaining).toEqual([
      { groupingId: "g1", bookId: "book-2", order: null },
    ]);
  });

  it("isCollection is true only for collection-type groupings", () => {
    expect(
      isCollection({ id: "g1", type: "collection", name: "x", createdAt: 1 }),
    ).toBe(true);
    expect(
      isCollection({ id: "g2", type: "series", name: "x", createdAt: 1 }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/services/storage/__tests__/groupings.test.ts`
Expected: FAIL — `../groupings` doesn't exist yet (module not found).

- [ ] **Step 3: Write minimal implementation**

In `src/services/storage/storage-types.ts`, add `seriesName`/`seriesIndex` to `StoredBook` (insert after `readingTimeMinutes?: number;`, line 51):

```ts
  seriesName?: string;
  seriesIndex?: number;
```

Then append two new interfaces at the end of the file:

```ts
/**
 * One row per series or user-created collection, discriminated by `type`.
 * A series has no independent lifecycle beyond "the set of books sharing
 * this metadata value" — it reuses the same shape rather than a separate
 * model, and read-only enforcement lives in isCollection()/the action
 * layer, not in the schema.
 */
export interface Grouping {
  id: string;
  type: "series" | "collection";
  name: string;
  createdAt: number;
}

/**
 * Join row for book membership in a grouping. `order` carries series
 * reading order (the book's seriesIndex) and is unused for collections.
 */
export interface GroupingMember {
  groupingId: string;
  bookId: string;
  order: number | null;
}
```

Create `src/utils/create-grouping-id.ts`:

```ts
import { v7 as uuidv7 } from "uuid";

export function createGroupingId() {
  return uuidv7();
}
```

In `src/services/storage/db.ts`, add the two new table declarations after `chapterText!: Table<StoredChapterText>;` (line 15):

```ts
  groupings!: Table<Grouping>;
  groupingMembers!: Table<GroupingMember>;
```

Add `Grouping` and `GroupingMember` to the type import at the top of the file (line 2-8):

```ts
import type {
  Grouping,
  GroupingMember,
  StoredBook,
  StoredBookCover,
  StoredBookFile,
  StoredChapterText,
  StoredSearchIndexEntry,
} from "./storage-types";
```

Then append a new `version(6)` block after the existing `version(5)` block (after line 59, before the closing `}` of the constructor):

```ts
// v6: adds series/collection grouping tables (Sprint 7). One `groupings`
// row per series or user collection, discriminated by `type`; membership
// lives in a separate `groupingMembers` join table so a book can belong
// to many collections. `order` carries series reading order and is
// unused for collections. No data migration — existing books simply
// have no grouping rows until series backfill runs or a user creates a
// collection.
this.version(6).stores({
  books: "id, title, author, createdAt, &fileHash, progress.updatedAt",
  bookFiles: "bookId",
  bookCovers: "bookId",
  searchIndex: "++id, word, bookId",
  chapterText: "[bookId+chapter], bookId",
  groupings: "id, type, name",
  groupingMembers: "[groupingId+bookId], groupingId, bookId",
});
```

Create `src/services/storage/groupings.ts`:

```ts
import { db } from "@/services/storage/db";
import type {
  Grouping,
  GroupingMember,
} from "@/services/storage/storage-types";

export async function getGrouping(id: string): Promise<Grouping | undefined> {
  return db.groupings.get(id);
}

export async function listGroupings(
  type?: Grouping["type"],
): Promise<Grouping[]> {
  const all = await db.groupings.toArray();
  return type ? all.filter((grouping) => grouping.type === type) : all;
}

export async function putGrouping(grouping: Grouping): Promise<void> {
  await db.groupings.put(grouping);
}

export async function deleteGrouping(id: string): Promise<void> {
  await db.groupings.delete(id);
}

export async function getMembersForBook(
  bookId: string,
): Promise<GroupingMember[]> {
  return db.groupingMembers.where({ bookId }).toArray();
}

export async function getMembersForGrouping(
  groupingId: string,
): Promise<GroupingMember[]> {
  return db.groupingMembers.where({ groupingId }).toArray();
}

export async function addMember(
  groupingId: string,
  bookId: string,
  order: number | null = null,
): Promise<void> {
  await db.groupingMembers.put({ groupingId, bookId, order });
}

export async function removeMember(
  groupingId: string,
  bookId: string,
): Promise<void> {
  await db.groupingMembers.delete([groupingId, bookId]);
}

/**
 * The one guard both the collection action layer (Day 3) and any UI
 * (Day 4/5) use to keep series read-only — no renameSeries/deleteSeries
 * exists, but this makes a future caller mistake a thrown error instead
 * of a silent series mutation.
 */
export function isCollection(grouping: Grouping): boolean {
  return grouping.type === "collection";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/services/storage/__tests__/groupings.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add src/services/storage/storage-types.ts src/services/storage/db.ts src/services/storage/groupings.ts src/services/storage/__tests__/groupings.test.ts src/utils/create-grouping-id.ts
git commit -m "feat(storage): add groupings/groupingMembers schema (v6) and CRUD module"
```

---

### Task 3: Series upsert-on-import

**Files:**

- Modify: `src/services/storage/groupings.ts`
- Modify: `src/features/library/actions/import-book.ts`
- Test: `src/services/storage/__tests__/groupings.test.ts`
- Test: `src/features/library/actions/__tests__/import-book.test.ts`

**Interfaces:**

- Consumes: `getGrouping`, `listGroupings`, `putGrouping`, `addMember` (all already in `groupings.ts` from Task 2).
- Produces: `hasSeriesMembership(bookId: string): Promise<boolean>` and `upsertSeriesMembership(bookId: string, seriesName: string, seriesIndex: number | null): Promise<void>`, both exported from `@/services/storage/groupings`. `upsertSeriesMembership` is consumed by `import-book.ts` here and by Task 5's backfill.

- [ ] **Step 1: Write the failing test for the storage functions**

Add to `src/services/storage/__tests__/groupings.test.ts` (append inside the existing `describe` block; add `hasSeriesMembership` and `upsertSeriesMembership` to the import from `"../groupings"`):

```ts
describe("upsertSeriesMembership", () => {
  it("creates a new series grouping on first use", async () => {
    await upsertSeriesMembership("book-1", "Foundation Series", 1);

    const series = await listGroupings("series");
    expect(series).toHaveLength(1);
    expect(series[0].name).toBe("Foundation Series");

    const members = await getMembersForBook("book-1");
    expect(members).toEqual([
      { groupingId: series[0].id, bookId: "book-1", order: 1 },
    ]);
  });

  it("reuses an existing series matched case-insensitively", async () => {
    await upsertSeriesMembership("book-1", "Foundation Series", 1);
    await upsertSeriesMembership("book-2", "foundation series", 2);

    const series = await listGroupings("series");
    expect(series).toHaveLength(1);

    const members = await getMembersForGrouping(series[0].id);
    expect(members).toHaveLength(2);
  });

  it("hasSeriesMembership reflects whether a book has a series row", async () => {
    expect(await hasSeriesMembership("book-1")).toBe(false);

    await upsertSeriesMembership("book-1", "Foundation Series", 1);

    expect(await hasSeriesMembership("book-1")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/services/storage/__tests__/groupings.test.ts`
Expected: FAIL — `upsertSeriesMembership`/`hasSeriesMembership` are not exported from `../groupings`.

- [ ] **Step 3: Write minimal implementation (storage layer)**

Append to `src/services/storage/groupings.ts`, after `isCollection`:

```ts
export async function hasSeriesMembership(bookId: string): Promise<boolean> {
  const members = await getMembersForBook(bookId);
  if (members.length === 0) return false;

  const groupings = await Promise.all(
    members.map((member) => getGrouping(member.groupingId)),
  );
  return groupings.some((grouping) => grouping?.type === "series");
}

/**
 * Upserts series membership for a book: reuses an existing series
 * grouping matched case-insensitively by name, or creates one. Called
 * from import (new books) and the backfill (pre-existing books) — see
 * ensureSeriesGroupings.
 */
export async function upsertSeriesMembership(
  bookId: string,
  seriesName: string,
  seriesIndex: number | null,
): Promise<void> {
  const existing = await listGroupings("series");
  const match = existing.find(
    (grouping) => grouping.name.toLowerCase() === seriesName.toLowerCase(),
  );

  const groupingId = match?.id ?? createGroupingId();

  if (!match) {
    await putGrouping({
      id: groupingId,
      type: "series",
      name: seriesName,
      createdAt: Date.now(),
    });
  }

  await addMember(groupingId, bookId, seriesIndex);
}
```

Add the `createGroupingId` import at the top of `src/services/storage/groupings.ts`:

```ts
import { createGroupingId } from "@/utils/create-grouping-id";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/services/storage/__tests__/groupings.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Write the failing test for import wiring**

Add to `src/features/library/actions/__tests__/import-book.test.ts`. Add these imports at the top:

```ts
import { EpubParser } from "@/services/epub/epub-parser";
import { getGrouping, getMembersForBook } from "@/services/storage/groupings";
```

Add this test inside the existing `describe("importBook", ...)` block:

```ts
it("creates a series grouping when the book has series metadata", async () => {
  vi.spyOn(EpubParser.prototype, "parseLibraryBook").mockResolvedValueOnce({
    metadata: {
      title: "Foundation",
      author: "Isaac Asimov",
      language: "en",
      description: null,
      seriesName: "Foundation Series",
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
  expect(book.seriesName).toBe("Foundation Series");
  expect(book.seriesIndex).toBe(1);

  const members = await getMembersForBook(book.id);
  expect(members).toHaveLength(1);

  const grouping = await getGrouping(members[0].groupingId);
  expect(grouping).toMatchObject({
    type: "series",
    name: "Foundation Series",
  });
});

it("does not create a series grouping when the book has no series metadata", async () => {
  const file = await loadFixture("valid-book.epub");
  await importBook(file);

  const [book] = await getAllBooks();
  expect(book.seriesName).toBeUndefined();
  expect(await getMembersForBook(book.id)).toHaveLength(0);
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm test:run src/features/library/actions/__tests__/import-book.test.ts`
Expected: FAIL — the first new test's `book.seriesName` is `undefined` and no membership row exists (nothing wires series metadata into `StoredBook` or `groupings` yet).

- [ ] **Step 7: Write minimal implementation (import wiring)**

In `src/features/library/actions/import-book.ts`, add the import:

```ts
import { upsertSeriesMembership } from "@/services/storage/groupings";
```

In the `book` object literal (lines 49-70), add two fields after `readingTimeMinutes,` (line 58):

```ts
      seriesName: metadata.seriesName,
      seriesIndex: metadata.seriesIndex,
```

After the existing search-index `try`/`catch` block (after line 91, before `return`), add:

```ts
// Mirrors the search-index try/catch above: series membership is
// derived data, and a failure here must not fail an otherwise-good
// import. ensureSeriesGroupings (Task 5) backfills it on next use.
if (metadata.seriesName) {
  try {
    await upsertSeriesMembership(
      bookId,
      metadata.seriesName,
      metadata.seriesIndex ?? null,
    );
  } catch (error) {
    logger.error("failed to upsert series grouping for imported book", error);
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm test:run src/features/library/actions/__tests__/import-book.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 9: Commit**

```bash
git add src/services/storage/groupings.ts src/services/storage/__tests__/groupings.test.ts src/features/library/actions/import-book.ts src/features/library/actions/__tests__/import-book.test.ts
git commit -m "feat(library): create series groupings for books with series metadata on import"
```

---

### Task 4: Series cleanup on book delete

**Files:**

- Modify: `src/services/storage/groupings.ts`
- Modify: `src/features/library/actions/delete-book.ts`
- Test: `src/services/storage/__tests__/groupings.test.ts`
- Test: `src/features/library/actions/__tests__/delete-book.test.ts`

**Interfaces:**

- Consumes: `db` (already imported in `groupings.ts`).
- Produces: `deleteMembersForBook(bookId: string): Promise<void>`, exported from `@/services/storage/groupings`, consumed by `delete-book.ts`.

- [ ] **Step 1: Write the failing test for the storage function**

Add to `src/services/storage/__tests__/groupings.test.ts` (add `deleteMembersForBook`, `getGrouping` to the import; `getGrouping` is already imported):

```ts
describe("deleteMembersForBook", () => {
  it("removes all of a book's memberships", async () => {
    await addMember("g1", "book-1", null);
    await addMember("g2", "book-1", null);
    await addMember("g1", "book-2", null);

    await deleteMembersForBook("book-1");

    expect(await getMembersForBook("book-1")).toHaveLength(0);
    expect(await getMembersForGrouping("g1")).toEqual([
      { groupingId: "g1", bookId: "book-2", order: null },
    ]);
  });

  it("deletes an emptied series grouping but keeps an emptied collection", async () => {
    await putGrouping({
      id: "series-1",
      type: "series",
      name: "Foundation Series",
      createdAt: 1,
    });
    await putGrouping({
      id: "collection-1",
      type: "collection",
      name: "Favorites",
      createdAt: 2,
    });
    await addMember("series-1", "book-1", 1);
    await addMember("collection-1", "book-1", null);

    await deleteMembersForBook("book-1");

    expect(await getGrouping("series-1")).toBeUndefined();
    expect(await getGrouping("collection-1")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/services/storage/__tests__/groupings.test.ts`
Expected: FAIL — `deleteMembersForBook` is not exported from `../groupings`.

- [ ] **Step 3: Write minimal implementation (storage layer)**

Append to `src/services/storage/groupings.ts`, after `upsertSeriesMembership`:

```ts
/**
 * Removes every grouping membership for a deleted book. A series
 * grouping that loses its last member is deleted too — a series only
 * exists because books with that metadata exist, so an empty one is
 * meaningless. Collections are never auto-deleted this way; a
 * user-created shelf is deliberately kept around empty.
 */
export async function deleteMembersForBook(bookId: string): Promise<void> {
  const members = await db.groupingMembers.where({ bookId }).toArray();
  const groupingIds = members.map((member) => member.groupingId);

  await db.groupingMembers.where({ bookId }).delete();

  for (const groupingId of groupingIds) {
    const grouping = await db.groupings.get(groupingId);
    if (grouping?.type !== "series") continue;

    const remaining = await db.groupingMembers.where({ groupingId }).count();
    if (remaining === 0) {
      await db.groupings.delete(groupingId);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/services/storage/__tests__/groupings.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Write the failing test for delete wiring**

Add to `src/features/library/actions/__tests__/delete-book.test.ts`. Add these imports at the top:

```ts
import { EpubParser } from "@/services/epub/epub-parser";
import { getMembersForBook, listGroupings } from "@/services/storage/groupings";
import { vi } from "vitest";
```

(`vi` may already be imported alongside `beforeEach, describe, expect, it` — add `vi` to that existing import instead of a separate line if so.)

Add this test inside the existing `describe("deleteBook", ...)` block:

```ts
it("removes series membership and deletes an emptied series grouping", async () => {
  vi.spyOn(EpubParser.prototype, "parseLibraryBook").mockResolvedValueOnce({
    metadata: {
      title: "Foundation",
      author: "Isaac Asimov",
      language: "en",
      description: null,
      seriesName: "Foundation Series",
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

  await deleteBook(book.id);

  expect(await getMembersForBook(book.id)).toHaveLength(0);
  expect(await listGroupings("series")).toHaveLength(0);
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm test:run src/features/library/actions/__tests__/delete-book.test.ts`
Expected: FAIL — `getMembersForBook(book.id)` still has 1 entry and the series grouping still exists after `deleteBook()` (nothing cleans up memberships yet).

- [ ] **Step 7: Write minimal implementation (delete wiring)**

In `src/features/library/actions/delete-book.ts`, add the import:

```ts
import { deleteMembersForBook } from "@/services/storage/groupings";
```

Add the call in `deleteBook`, after the existing `deleteChapterText(bookId);` line and before `libraryStore.getState().removeBook(bookId);`:

```ts
await deleteMembersForBook(bookId);
```

The full function becomes:

```ts
export async function deleteBook(bookId: string): Promise<void> {
  await deleteBookFromStorage(bookId);
  await deleteIndex(bookId);
  await deleteChapterText(bookId);
  await deleteMembersForBook(bookId);
  libraryStore.getState().removeBook(bookId);
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm test:run src/features/library/actions/__tests__/delete-book.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 9: Commit**

```bash
git add src/services/storage/groupings.ts src/services/storage/__tests__/groupings.test.ts src/features/library/actions/delete-book.ts src/features/library/actions/__tests__/delete-book.test.ts
git commit -m "feat(library): clean up grouping membership on book delete"
```

---

### Task 5: Lazy series backfill for pre-existing libraries

**Files:**

- Modify: `src/services/storage/groupings.ts`
- Test: `src/services/storage/__tests__/groupings.test.ts`

**Interfaces:**

- Consumes: `getBook(bookId: string): Promise<StoredBook | undefined>` from `@/services/storage/book-repository`; `hasSeriesMembership`, `upsertSeriesMembership` (Task 3).
- Produces: `ensureSeriesGroupings(bookIds: string[]): Promise<void>`, exported from `@/services/storage/groupings`. Not wired into any screen yet — Day 4's series/collection screens (out of this plan's scope) will call it the same way `ensureIndexesForBooks()` is called from `searchLibrary()`.

- [ ] **Step 1: Write the failing test**

Add to `src/services/storage/__tests__/groupings.test.ts`. Add these imports at the top:

```ts
import { EpubParser } from "@/services/epub/epub-parser";
import * as bookRepository from "@/services/storage/book-repository";
import { getAllBooks } from "@/services/storage/book-repository";
import { importBook } from "@/features/library/actions/import-book";
import { loadFixture } from "@/tests/utils/load-fixtures";
```

(Add `ensureSeriesGroupings` and `getGrouping` to the existing import from `"../groupings"` if not already present — `getGrouping` is already imported from Task 2.)

```ts
describe("ensureSeriesGroupings", () => {
  const mockSeriesMetadata = () => {
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
  };

  it("derives series membership from a book's cached seriesName without reading the file", async () => {
    mockSeriesMetadata();
    const file = await loadFixture("valid-book.epub");
    await importBook(file);
    const [book] = await getAllBooks();

    // Simulate a lost/pre-existing membership row while the cached
    // seriesName survives on StoredBook (import already wrote it).
    const [member] = await getMembersForBook(book.id);
    await removeMember(member.groupingId, book.id);
    expect(await getMembersForBook(book.id)).toHaveLength(0);

    const getBookFileSpy = vi.spyOn(bookRepository, "getBookFile");

    await ensureSeriesGroupings([book.id]);

    expect(getBookFileSpy).not.toHaveBeenCalled();
    const members = await getMembersForBook(book.id);
    expect(members).toHaveLength(1);
    const grouping = await getGrouping(members[0].groupingId);
    expect(grouping?.name).toBe("Dune Saga");
  });

  it("skips books that already have a series membership", async () => {
    mockSeriesMetadata();
    const file = await loadFixture("valid-book.epub");
    await importBook(file);
    const [book] = await getAllBooks();

    const before = await getMembersForBook(book.id);

    await ensureSeriesGroupings([book.id]);

    expect(await getMembersForBook(book.id)).toEqual(before);
  });

  it("does nothing for a book with no cached seriesName", async () => {
    const file = await loadFixture("valid-book.epub");
    await importBook(file);
    const [book] = await getAllBooks();

    await ensureSeriesGroupings([book.id]);

    expect(await getMembersForBook(book.id)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/services/storage/__tests__/groupings.test.ts`
Expected: FAIL — `ensureSeriesGroupings` is not exported from `../groupings`.

- [ ] **Step 3: Write minimal implementation**

Add the import at the top of `src/services/storage/groupings.ts`:

```ts
import { getBook } from "@/services/storage/book-repository";
```

Append to `src/services/storage/groupings.ts`, after `deleteMembersForBook`:

```ts
/**
 * Backfills series membership for books that predate this schema (or
 * otherwise lost their membership row) — checked via a cheap
 * hasSeriesMembership lookup per book, deriving from the seriesName
 * already cached on StoredBook rather than re-reading/re-parsing the
 * EPUB file. Mirrors ensureIndexesForBooks's shape (Sprint 6).
 */
export async function ensureSeriesGroupings(bookIds: string[]): Promise<void> {
  await Promise.all(
    bookIds.map(async (bookId) => {
      if (await hasSeriesMembership(bookId)) return;

      const book = await getBook(bookId);
      if (!book?.seriesName) return;

      await upsertSeriesMembership(
        bookId,
        book.seriesName,
        book.seriesIndex ?? null,
      );
    }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/services/storage/__tests__/groupings.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Run the full suite**

Run: `pnpm test:run`
Expected: all tests pass, including every new/modified file from Tasks 1-5.

- [ ] **Step 6: Commit**

```bash
git add src/services/storage/groupings.ts src/services/storage/__tests__/groupings.test.ts
git commit -m "feat(library): backfill series groupings for pre-existing books"
```

---

### Task 6: Navigation route constants

**Files:**

- Modify: `src/utils/routes.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `ROUTES.LIBRARY_SERIES` and `ROUTES.LIBRARY_COLLECTION` string constants, to be consumed by Day 4's series/collection screens and `router.tsx` (out of this plan's scope — no screens or routes are wired yet, matching the spec's "Day 1 only adds the route constants and confirms the pattern fits").

- [ ] **Step 1: Add the route constants**

Replace `src/utils/routes.ts`:

```ts
export const ROUTES = {
  LIBRARY: "/library",
  LIBRARY_AUTHOR: "/library/author/:author",
  LIBRARY_SERIES: "/library/series/:groupingId",
  LIBRARY_COLLECTION: "/library/collection/:groupingId",
  READER: "/reader/:bookId",
  SEARCH: "/search",
  SETTINGS: "/settings",
};
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/routes.ts
git commit -m "feat(library): add route constants for series and collection browsing"
```

---

### Task 7: Update sprint task list

**Files:**

- Modify: `tasks/SPRINT-07-TASKS.md` (Day 1 section)

**Interfaces:**

- Consumes: nothing (documentation-only task).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Mark Day 1 items done**

In `tasks/SPRINT-07-TASKS.md`, update the Day 1 section (items 1-3 and the Done Criteria line) to ✅, noting: the unified `groupings`/`groupingMembers` schema (v6) with `isCollection()` read-only guard; Calibre-only series metadata parsing folded in from Day 2 since the schema needed real data to validate against; series build-on-import/delete-cleanup/lazy-backfill lifecycle (backfill moved into Day 1 per decision during brainstorming); route constants added with no screens/router wiring yet (Day 4 scope). Cross-reference that Day 2's "automatic series detection" and "reading order within a series" items are now largely satisfied by this day's work, leaving Day 2 mostly the series _browsing view_ itself.

- [ ] **Step 2: Commit**

```bash
git add tasks/SPRINT-07-TASKS.md
git commit -m "docs: mark Sprint 7 Day 1 organization architecture done"
```

---

## Self-Review Notes

- **Spec coverage:** all 10 decisions in the design doc map to tasks — unified `groupings` table (Task 2), join table (Task 2), v6 schema (Task 2), cached `seriesName`/`seriesIndex` on `StoredBook` (Task 2, populated in Task 3), Calibre-only OPF parsing (Task 1), series build/delete/backfill lifecycle (Tasks 3-5), `isCollection()` guard (Task 2), navigation route shape (Task 6), export-friendliness (satisfied by design — every field is a plain string/number, no task needed). Decision 8's action-layer files (`renameCollection` etc.) are explicitly Day 3 scope, not built here — `isCollection()` is defined now so Day 3 has it ready.
- **Placeholder scan:** none found — every step has runnable code or an exact constant/file replacement.
- **Type consistency:** `Grouping { id, type, name, createdAt }` and `GroupingMember { groupingId, bookId, order }` used identically across Tasks 2-5. `hasSeriesMembership(bookId: string): Promise<boolean>`, `upsertSeriesMembership(bookId: string, seriesName: string, seriesIndex: number | null): Promise<void>`, `deleteMembersForBook(bookId: string): Promise<void>`, `ensureSeriesGroupings(bookIds: string[]): Promise<void>` all match between their defining task and every consuming task/test.
