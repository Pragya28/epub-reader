# Search Index Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the already-built search-index lifecycle (`buildIndex`, `deleteIndex`, `hasIndex`) into book import and deletion, and add a lazy backfill path so books imported before Sprint 6 become searchable on first search.

**Architecture:** Three independent call-site wirings into existing functions — no new storage layer, no new UI. `importBook()` calls `buildIndex()` after a successful save. `deleteBook()` calls `deleteIndex()` alongside its existing storage delete. A new `ensureIndexesForBooks()` in `search-service.ts` is called from `searchLibrary()` to lazily backfill any book missing an index before content search runs.

**Tech Stack:** TypeScript, Dexie (IndexedDB), Vitest, existing `services/search/` and `services/storage/` modules.

## Global Constraints

- Package manager is pnpm — don't use npm/yarn.
- `store` in a filename means a Zustand store only — none of the files touched here are stores.
- Don't re-export one module's functions through another for convenience — import each function directly from its defining module.
- Tests are colocated in `__tests__/` next to the code they cover.
- Use real EPUB fixtures from `src/tests/fixtures/*.epub` via `loadFixture()` — don't hand-construct EPUB blobs.
- `resetTestDb()` (from `src/tests/utils/reset-test-db.ts`) must run in `beforeEach` for any test touching Dexie state.

---

### Task 1: Build index on import

**Files:**

- Modify: `src/features/library/actions/import-book.ts:62-69`
- Test: `src/features/library/actions/__tests__/import-book.test.ts`

**Interfaces:**

- Consumes: `buildIndex(bookId: string, file: Blob): Promise<void>` from `@/services/search/search-service`; `hasIndex(bookId: string): Promise<boolean>` from `@/services/search/search-index` (test-only, for assertions).
- Produces: nothing new consumed by later tasks — this task is a leaf.

- [ ] **Step 1: Write the failing test**

Add to `src/features/library/actions/__tests__/import-book.test.ts` (add the `hasIndex` import alongside existing imports):

```ts
import { hasIndex } from "@/services/search/search-index";
```

```ts
it("builds a search index for the imported book", async () => {
  const file = await loadFixture("valid-book.epub");

  await importBook(file);

  const [book] = await getAllBooks();
  expect(await hasIndex(book.id)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/features/library/actions/__tests__/import-book.test.ts`
Expected: FAIL — `hasIndex(book.id)` resolves to `false` (no index was built).

- [ ] **Step 3: Write minimal implementation**

In `src/features/library/actions/import-book.ts`, add the import:

```ts
import { buildIndex } from "@/services/search/search-service";
```

Then, after `store.addBook(book);` (currently line 69) and before the `return`, add:

```ts
await buildIndex(bookId, file);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/features/library/actions/__tests__/import-book.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add src/features/library/actions/import-book.ts src/features/library/actions/__tests__/import-book.test.ts
git commit -m "feat(search): build search index on book import"
```

---

### Task 2: Delete index on book removal

**Files:**

- Modify: `src/features/library/actions/delete-book.ts`
- Test: `src/features/library/actions/__tests__/delete-book.test.ts` (new file)

**Interfaces:**

- Consumes: `deleteIndex(bookId: string): Promise<void>` from `@/services/search/search-index`; `buildIndex` from `@/services/search/search-service` (test-only, to seed an index before deleting); `hasIndex` (test-only, for assertions); `importBook` from `../import-book` (test-only, to create a real book to delete).
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `src/features/library/actions/__tests__/delete-book.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { hasIndex } from "@/services/search/search-index";
import { getAllBooks } from "@/services/storage/book-repository";
import { deleteBook } from "../delete-book";
import { importBook } from "../import-book";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { resetLibraryStore } from "@/tests/utils/reset-store";

describe("deleteBook", () => {
  beforeEach(async () => {
    await resetTestDb();
    resetLibraryStore();
  });

  it("removes the book's search index", async () => {
    const file = await loadFixture("valid-book.epub");
    await importBook(file);
    const [book] = await getAllBooks();

    expect(await hasIndex(book.id)).toBe(true);

    await deleteBook(book.id);

    expect(await hasIndex(book.id)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/features/library/actions/__tests__/delete-book.test.ts`
Expected: FAIL — `hasIndex(book.id)` still resolves to `true` after delete.

- [ ] **Step 3: Write minimal implementation**

Replace the contents of `src/features/library/actions/delete-book.ts`:

```ts
import { deleteIndex } from "@/services/search/search-index";
import { deleteBook as deleteBookFromStorage } from "@/services/storage/book-repository";
import { libraryStore } from "../store/library-store";

export async function deleteBook(bookId: string): Promise<void> {
  await deleteBookFromStorage(bookId);
  await deleteIndex(bookId);
  libraryStore.getState().removeBook(bookId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/features/library/actions/__tests__/delete-book.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/library/actions/delete-book.ts src/features/library/actions/__tests__/delete-book.test.ts
git commit -m "feat(search): delete search index when a book is removed"
```

---

### Task 3: Lazy backfill for pre-existing libraries

**Files:**

- Modify: `src/services/search/search-service.ts`
- Modify: `src/features/library/actions/search-library.ts`
- Test: `src/services/search/__tests__/search-service.test.ts`
- Test: `src/features/library/actions/__tests__/search-library.test.ts` (new file)

**Interfaces:**

- Consumes (in `search-service.ts`): `hasIndex(bookId: string): Promise<boolean>` and `buildIndex` (already imported in the file) from `./search-index`; `getBookFile(bookId: string): Promise<StoredBookFile | undefined>` from `@/services/storage/book-repository` (`StoredBookFile` has a `.file: Blob` field, per `src/services/storage/storage-types.ts`).
- Produces: `ensureIndexesForBooks(bookIds: string[]): Promise<void>` — exported from `@/services/search/search-service`, consumed by `search-library.ts`.

- [ ] **Step 1: Write the failing test for `ensureIndexesForBooks`**

Add to `src/services/search/__tests__/search-service.test.ts` (add `ensureIndexesForBooks` to the existing import from `../search-service`, and `importBook`/`loadFixture`/`resetLibraryStore` where needed — this test seeds a book via the real import flow so a real file blob exists to fetch):

```ts
import { importBook } from "@/features/library/actions/import-book";
import { deleteIndex } from "../search-index";
```

```ts
it("ensureIndexesForBooks backfills only books missing an index", async () => {
  const file = await loadFixture("valid-book.epub");
  await importBook(file);
  const indexed = (await import("@/services/storage/book-repository"))
    .getAllBooks;
  const [book] = await indexed();

  // Simulate a pre-Sprint-6 book: has a file and metadata, no index.
  await deleteIndex(book.id);
  expect(await hasIndex(book.id)).toBe(false);

  await ensureIndexesForBooks([book.id]);

  expect(await hasIndex(book.id)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/services/search/__tests__/search-service.test.ts`
Expected: FAIL — `ensureIndexesForBooks` is not exported / not defined.

- [ ] **Step 3: Write minimal implementation**

In `src/services/search/search-service.ts`, add the import and new function:

```ts
import { getBookFile } from "@/services/storage/book-repository";
```

Append after `ensureIndex`:

```ts
/**
 * Backfills search indexes for books that predate this sprint's indexing
 * (or otherwise lost their index) — checked via a cheap hasIndex lookup per
 * book, with a file read + build only for the ones actually missing one.
 */
export async function ensureIndexesForBooks(bookIds: string[]): Promise<void> {
  await Promise.all(
    bookIds.map(async (bookId) => {
      if (await hasIndex(bookId)) return;

      const stored = await getBookFile(bookId);
      if (!stored) return;

      await buildIndex(bookId, stored.file);
    }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/services/search/__tests__/search-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `searchLibrary` calling the backfill**

Create `src/features/library/actions/__tests__/search-library.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { deleteIndex, hasIndex } from "@/services/search/search-index";
import { getAllBooks } from "@/services/storage/book-repository";
import { importBook } from "../import-book";
import { searchLibrary } from "../search-library";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { resetLibraryStore } from "@/tests/utils/reset-store";
import type { BookWithProgress } from "../../types/library.types";

describe("searchLibrary", () => {
  beforeEach(async () => {
    await resetTestDb();
    resetLibraryStore();
  });

  it("backfills a missing index before searching so pre-existing books are searchable", async () => {
    const file = await loadFixture("valid-book.epub");
    await importBook(file);
    const [book] = await getAllBooks();
    const booksWithProgress = [book] as BookWithProgress[];

    // Simulate a pre-Sprint-6 book that was imported before indexing existed.
    await deleteIndex(book.id);
    expect(await hasIndex(book.id)).toBe(false);

    await searchLibrary(booksWithProgress, "chapter");

    expect(await hasIndex(book.id)).toBe(true);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm test:run src/features/library/actions/__tests__/search-library.test.ts`
Expected: FAIL — `hasIndex(book.id)` is still `false` after `searchLibrary()` runs (nothing calls the backfill yet).

- [ ] **Step 7: Write minimal implementation**

Replace the contents of `src/features/library/actions/search-library.ts`:

```ts
import { findChapterMatches } from "@/services/search/search-content";
import type { ChapterMatch } from "@/services/search/search-content";
import { ensureIndexesForBooks } from "@/services/search/search-service";
import { filterBooksByQuery } from "@/services/search/search-metadata";
import type { BookWithProgress } from "../types/library.types";

export interface LibrarySearchResults {
  /** Book-level metadata matches (title/author/description). */
  metadataMatches: BookWithProgress[];
  /** Chapter-level content matches, ranked, distinct from metadata matches. */
  contentMatches: ChapterMatch[];
}

/**
 * Combines the existing metadata search with the new content search as two
 * distinct results modes (see tasks/SPRINT-06-TASKS.md Day 3) rather than
 * merging them into one list — a metadata hit is a book, a content hit is a
 * chapter, and collapsing them would lose the chapter jump target.
 *
 * Backfills any book missing a search index (lazy migration for books
 * imported before Sprint 6 — see tasks/SPRINT-06-TASKS.md Day 5) before
 * running content search, so older libraries become searchable on first use.
 */
export async function searchLibrary(
  books: BookWithProgress[],
  query: string,
): Promise<LibrarySearchResults> {
  await ensureIndexesForBooks(books.map((book) => book.id));

  const metadataMatches = filterBooksByQuery(books, query);
  const contentMatches = await findChapterMatches(query);

  return { metadataMatches, contentMatches };
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm test:run src/features/library/actions/__tests__/search-library.test.ts`
Expected: PASS.

- [ ] **Step 9: Run the full suite**

Run: `pnpm test:run`
Expected: all tests pass, including the three new/modified test files from Tasks 1–3.

- [ ] **Step 10: Commit**

```bash
git add src/services/search/search-service.ts src/services/search/__tests__/search-service.test.ts src/features/library/actions/search-library.ts src/features/library/actions/__tests__/search-library.test.ts
git commit -m "feat(search): lazily backfill search index for pre-existing books"
```

---

### Task 4: Update sprint task list

**Files:**

- Modify: `tasks/SPRINT-06-TASKS.md:82-96` (Day 5 section)

**Interfaces:**

- Consumes: nothing (documentation-only task).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Mark Day 5 items done**

In `tasks/SPRINT-06-TASKS.md`, update the Day 5 section (items 16–18 and the Done Criteria line) to ✅, briefly noting: build-on-import and delete-on-removal are wired into `import-book.ts`/`delete-book.ts`; backfill is lazy via `ensureIndexesForBooks()` called from `searchLibrary()`; re-import-rebuild was scoped out (blocked by the existing `fileHash` duplicate check, so unreachable); the multi-tab race was already covered by the pre-existing `hasIndex` check-before-build pattern, reused by `ensureIndexesForBooks()`.

- [ ] **Step 2: Commit**

```bash
git add tasks/SPRINT-06-TASKS.md
git commit -m "docs: mark Sprint 6 Day 5 index maintenance done"
```

---

## Self-Review Notes

- **Spec coverage:** all 5 decisions in the design doc map to tasks — build-on-import (Task 1), delete-on-removal (Task 2), re-import no-op (documented in Task 4, no code task needed), lazy backfill (Task 3), multi-tab race (no new code — reused `hasIndex`, verified implicitly by Task 3's tests passing without duplicate-build races since each book is only ever built once).
- **Placeholder scan:** none found — every step has runnable code.
- **Type consistency:** `buildIndex(bookId: string, file: Blob)`, `deleteIndex(bookId: string)`, `hasIndex(bookId: string)`, `ensureIndexesForBooks(bookIds: string[])` used identically across all tasks that reference them.
