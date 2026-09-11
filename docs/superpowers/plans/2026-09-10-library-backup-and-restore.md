# Library Backup & Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Sprint 8 Day 6's backup/restore feature — a one-file ZIP export of the whole library (books, covers, reading progress, collections, preferences) and a merge-on-import restore, plus a "Reset library" action.

**Architecture:** A framework-agnostic `services/backup/` module owns the ZIP format (`createArchive`/`readArchive`). `features/library/actions/` orchestrates: `export-library.ts` reads storage + snapshots preferences into an archive; `import-backup.ts` merges an archive back in, keyed by `fileHash`, prompting per-book on chapter-level reading-progress conflicts; `reset-library.ts` wipes everything. A `use-backup.ts` hook wires the Settings UI (download trigger, file picker, conflict dialog). No DB schema change.

**Tech Stack:** React 19, TypeScript, Zustand, Dexie/IndexedDB, JSZip (already a dependency), Vitest + fake-indexeddb, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-10-library-backup-and-restore-design.md`

## Global Constraints

- **Package manager: pnpm** — never npm/yarn. Do not add dependencies (JSZip is already present).
- **Do not run build/lint/test/format or any shell command without the user approving it first** (project CLAUDE.md). Each task's "run the test" steps are for the user to run or approve.
- **One task at a time** — after a task's implementation, tests, and commit are done, STOP and wait for explicit go-ahead before the next task (project CLAUDE.md).
- **Ponytail mode (full)** — simplest thing that works; stdlib/native/existing-dependency first; no speculative abstraction.
- **Edit style** — `str_replace`-style edits scoped to the function/section; don't rewrite whole files; don't scan the codebase.
- **CSS** — no `height`/`width` in styles unless unavoidable; space flex/grid children with the container's `gap`, never per-child `m*-*`.
- **Imports** — import each function directly from the module that defines it; no convenience re-exports.
- **`store` in a filename means a Zustand store** — the backup modules are not stores, so none of them is named `*-store`.
- **`src/components/ui/` is shadcn-only** — the conflict dialog is app-specific, so it lives in `src/features/library/components/`, not `ui/`.
- **Comments** — state the current fact only; no "previously", no changelog narration. Mark deliberate simplifications with a `// ponytail:` comment.
- **Colocated tests** — `__tests__/` next to the code, Vitest + `fake-indexeddb` (loaded globally by `src/tests/setup.ts`).
- **Commit message trailer** — end every commit body with:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- Work happens on the existing branch `sprint-8-day-6-backup-restore`.

---

## File Structure

| File                                                            | Responsibility                                                                                                               |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/services/backup/backup-types.ts`                           | `BACKUP_VERSION`, `PreferencesSnapshot`, `BackupManifest`, `BackupData`, `BackupFormatError`                                 |
| `src/services/backup/backup-archive.ts`                         | `createArchive(data) → Blob`, `readArchive(blob) → BackupData`. ZIP I/O + manifest validation only. No Dexie/Zustand/notify. |
| `src/services/backup/__tests__/backup-archive.test.ts`          | round-trip + rejection tests                                                                                                 |
| `src/features/library/actions/export-library.ts`                | `exportLibrary() → Blob` — gather storage + preferences, call `createArchive`                                                |
| `src/features/library/actions/__tests__/export-library.test.ts` | fixture in → archive contents asserted                                                                                       |
| `src/features/library/actions/reset-library.ts`                 | `resetLibrary()` — clear all 7 tables + OPFS files + revoke cover URLs + reset stores                                        |
| `src/features/library/actions/__tests__/reset-library.test.ts`  | all tables empty, stores reset                                                                                               |
| `src/features/library/actions/import-backup.ts`                 | `readBackup(file)`, `applyBackup(data, resolutions)`, `ProgressConflict`, `ConflictResolution`, `ApplyBackupSummary`         |
| `src/features/library/actions/__tests__/import-backup.test.ts`  | restore / dedupe / conflict / preferences cases                                                                              |
| `src/utils/download-blob.ts`                                    | `downloadBlob(blob, filename)` — object-URL + synthetic `<a download>` click                                                 |
| `src/utils/__tests__/download-blob.test.ts`                     | anchor gets href + download, is clicked, URL revoked                                                                         |
| `src/features/library/hooks/use-backup.ts`                      | `useBackup()` — export/import state machine, conflict-dialog wiring, toasts                                                  |
| `src/features/library/hooks/__tests__/use-backup.test.ts`       | export success/failure, import happy path, conflict pause/resume                                                             |
| `src/features/library/components/backup-conflict-dialog.tsx`    | `BackupConflictDialog` — lists conflicts, per-book Keep / Use-backup, Apply / Cancel                                         |
| `src/app/screens/settings/settings-screen.tsx`                  | +"Backup & Restore" section; +"Delete all books & data" row in Storage                                                       |
| `src/app/screens/settings/__tests__/settings-screen.test.tsx`   | export button, import input, reset confirm rendered                                                                          |
| `e2e/backup-restore.spec.ts`                                    | import → read → export → reset → import → progress restored                                                                  |
| `docs/tasks/SPRINT-08-TASKS.md`, `CLAUDE.md`                    | status + architecture doc updates                                                                                            |

---

## Task 1: Backup archive format (`services/backup/`)

**Files:**

- Create: `src/services/backup/backup-types.ts`
- Create: `src/services/backup/backup-archive.ts`
- Test: `src/services/backup/__tests__/backup-archive.test.ts`

**Interfaces:**

- Consumes: `jszip` (`import JSZip from "jszip"`); `StoredBook`, `Grouping`, `GroupingMember` from `@/services/storage/storage-types`; `AppTheme`, `ReaderFontId` from `@/features/preferences/types/preferences.types`.
- Produces:
  - `const BACKUP_VERSION = 1`
  - `interface PreferencesSnapshot { theme: AppTheme; applyThemeToReader: boolean; readerFont: ReaderFontId; readerTheme: AppTheme; fontScale: number; lineHeight: number; margins: number; paragraphSpacing: number; keepScreenAwake: boolean; keepScreenAwakeMinutes: number }`
  - `interface BackupManifest { version: number; exportedAt: number; books: StoredBook[]; groupings: Grouping[]; groupingMembers: GroupingMember[]; preferences: PreferencesSnapshot }`
  - `interface BackupData { manifest: BackupManifest; files: Map<string, Blob>; covers: Map<string, Blob> }` — `files`/`covers` keyed by the manifest's book `id`
  - `class BackupFormatError extends Error`
  - `createArchive(data: BackupData): Promise<Blob>`
  - `readArchive(input: Blob): Promise<BackupData>` — throws `BackupFormatError` on a non-zip, a missing/unparseable `manifest.json`, or `manifest.version > BACKUP_VERSION`

- [ ] **Step 1: Write the failing test**

Create `src/services/backup/__tests__/backup-archive.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createArchive, readArchive } from "../backup-archive";
import { BACKUP_VERSION, type BackupData } from "../backup-types";

function sample(): BackupData {
  return {
    manifest: {
      version: BACKUP_VERSION,
      exportedAt: 1_700_000_000_000,
      books: [
        { id: "b1", title: "Book One", createdAt: 1, fileHash: "hash-1" },
      ],
      groupings: [
        {
          id: "g1",
          type: "collection",
          name: "Favorites",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      groupingMembers: [{ groupingId: "g1", bookId: "b1", order: 0 }],
      preferences: {
        theme: "system",
        applyThemeToReader: true,
        readerFont: "literata",
        readerTheme: "system",
        fontScale: 1,
        lineHeight: 1.6,
        margins: 16,
        paragraphSpacing: 8,
        keepScreenAwake: true,
        keepScreenAwakeMinutes: 20,
      },
    },
    files: new Map([["b1", new Blob(["epub-bytes"])]]),
    covers: new Map([["b1", new Blob(["cover-bytes"])]]),
  };
}

describe("backup archive", () => {
  it("round-trips the manifest and blob contents", async () => {
    const restored = await readArchive(await createArchive(sample()));

    expect(restored.manifest).toEqual(sample().manifest);
    expect(await restored.files.get("b1")!.text()).toBe("epub-bytes");
    expect(await restored.covers.get("b1")!.text()).toBe("cover-bytes");
  });

  it("rejects a file that isn't a zip", async () => {
    await expect(readArchive(new Blob(["nope"]))).rejects.toThrow(
      /isn't a Librune backup/,
    );
  });

  it("rejects a zip with no manifest", async () => {
    const zip = new JSZip();
    zip.file("junk.txt", "x");
    await expect(
      readArchive(await zip.generateAsync({ type: "blob" })),
    ).rejects.toThrow(/isn't a Librune backup/);
  });

  it("rejects a backup from a newer format version", async () => {
    const data = sample();
    data.manifest.version = BACKUP_VERSION + 1;
    await expect(readArchive(await createArchive(data))).rejects.toThrow(
      /newer version of Librune/,
    );
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `pnpm test:run src/services/backup/__tests__/backup-archive.test.ts`
Expected: FAIL — `Cannot find module '../backup-archive'`.

- [ ] **Step 3: Write `backup-types.ts`**

Create `src/services/backup/backup-types.ts`:

```ts
import type {
  AppTheme,
  ReaderFontId,
} from "@/features/preferences/types/preferences.types";
import type {
  Grouping,
  GroupingMember,
  StoredBook,
} from "@/services/storage/storage-types";

/** The backup *format* version — the only thing import compatibility keys
 * on. Standalone integer, unrelated to any app version (there isn't one at
 * runtime yet — Sprint 8 Day 7). Bump only on a breaking manifest change. */
export const BACKUP_VERSION = 1;

/** All ten persisted `preferencesStore` keys, snapshotted whole. */
export interface PreferencesSnapshot {
  theme: AppTheme;
  applyThemeToReader: boolean;
  readerFont: ReaderFontId;
  readerTheme: AppTheme;
  fontScale: number;
  lineHeight: number;
  margins: number;
  paragraphSpacing: number;
  keepScreenAwake: boolean;
  keepScreenAwakeMinutes: number;
}

export interface BackupManifest {
  version: number;
  exportedAt: number;
  books: StoredBook[];
  groupings: Grouping[];
  groupingMembers: GroupingMember[];
  preferences: PreferencesSnapshot;
}

/** In-memory form of an archive: the manifest plus the raw blobs, both
 * maps keyed by the manifest book `id`. */
export interface BackupData {
  manifest: BackupManifest;
  files: Map<string, Blob>;
  covers: Map<string, Blob>;
}

/** Thrown by readArchive for anything that isn't a readable current-or-older
 * Librune backup. Carries a user-facing message. */
export class BackupFormatError extends Error {}
```

- [ ] **Step 4: Write `backup-archive.ts`**

Create `src/services/backup/backup-archive.ts`:

```ts
import JSZip from "jszip";
import {
  BACKUP_VERSION,
  BackupFormatError,
  type BackupData,
  type BackupManifest,
} from "./backup-types";

const MANIFEST = "manifest.json";
const BOOKS_DIR = "books/";
const COVERS_DIR = "covers/";
const EPUB_EXT = ".epub";

const NOT_A_BACKUP = "This file isn't a Librune backup.";

export async function createArchive(data: BackupData): Promise<Blob> {
  const zip = new JSZip();
  zip.file(MANIFEST, JSON.stringify(data.manifest, null, 2));

  for (const [bookId, file] of data.files) {
    zip.file(`${BOOKS_DIR}${bookId}${EPUB_EXT}`, file);
  }
  for (const [bookId, cover] of data.covers) {
    zip.file(`${COVERS_DIR}${bookId}`, cover);
  }

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export async function readArchive(input: Blob): Promise<BackupData> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(input);
  } catch {
    throw new BackupFormatError(NOT_A_BACKUP);
  }

  const manifestEntry = zip.file(MANIFEST);
  if (!manifestEntry) throw new BackupFormatError(NOT_A_BACKUP);

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(
      await manifestEntry.async("string"),
    ) as BackupManifest;
  } catch {
    throw new BackupFormatError(NOT_A_BACKUP);
  }

  if (typeof manifest.version !== "number" || !Array.isArray(manifest.books)) {
    throw new BackupFormatError(NOT_A_BACKUP);
  }
  if (manifest.version > BACKUP_VERSION) {
    throw new BackupFormatError(
      "This backup was made by a newer version of Librune — update the app and try again.",
    );
  }

  const files = new Map<string, Blob>();
  const covers = new Map<string, Blob>();

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (path.startsWith(BOOKS_DIR) && path.endsWith(EPUB_EXT)) {
      const bookId = path.slice(BOOKS_DIR.length, -EPUB_EXT.length);
      files.set(bookId, await entry.async("blob"));
    } else if (path.startsWith(COVERS_DIR)) {
      const bookId = path.slice(COVERS_DIR.length);
      if (bookId) covers.set(bookId, await entry.async("blob"));
    }
  }

  return { manifest, files, covers };
}
```

- [ ] **Step 5: Run the test, confirm it passes**

Run: `pnpm test:run src/services/backup/__tests__/backup-archive.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/services/backup
git commit -m "$(cat <<'EOF'
feat(backup): ZIP archive format for library backups

createArchive/readArchive — manifest.json + books/<id>.epub + covers/<id>.
Framework-agnostic; validates format version and rejects non-backups.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: STOP** — wait for go-ahead before Task 2.

---

## Task 2: Export the library (`export-library.ts`)

**Files:**

- Create: `src/features/library/actions/export-library.ts`
- Test: `src/features/library/actions/__tests__/export-library.test.ts`

**Interfaces:**

- Consumes:
  - Task 1: `createArchive`, `BACKUP_VERSION`, `BackupData`, `PreferencesSnapshot`
  - `getAllBooks`, `getBookCover` from `@/services/storage/book-repository`
  - `getBookFile` from `@/services/storage/book-files` (returns `{ bookId, file: Blob } | undefined`)
  - `listGroupings`, `getMembersForGrouping` from `@/services/storage/groupings`
  - `preferencesStore` from `@/features/preferences/store/preferences-store`
  - `logger` from `@/shared/logger/logger`
- Produces: `exportLibrary(): Promise<Blob>`

- [ ] **Step 1: Write the failing test**

Create `src/features/library/actions/__tests__/export-library.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { readArchive } from "@/services/backup/backup-archive";
import { importBook } from "../import-book";
import { createCollection, addBookToCollection } from "../collections";
import { exportLibrary } from "../export-library";

beforeEach(async () => {
  await resetTestDb();
});

describe("exportLibrary", () => {
  it("packs books, files, collections and preferences into an archive", async () => {
    const { id } = await importBook(await loadFixture("valid-book.epub"));
    const collectionId = await createCollection("Favorites");
    await addBookToCollection(collectionId, id);

    const data = await readArchive(await exportLibrary());

    expect(data.manifest.books.map((b) => b.id)).toEqual([id]);
    expect(data.files.has(id)).toBe(true);
    expect(data.manifest.groupings.some((g) => g.name === "Favorites")).toBe(
      true,
    );
    expect(data.manifest.groupingMembers).toContainEqual(
      expect.objectContaining({ groupingId: collectionId, bookId: id }),
    );
    expect(data.manifest.preferences.fontScale).toBe(1);
    expect(data.manifest.version).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `pnpm test:run src/features/library/actions/__tests__/export-library.test.ts`
Expected: FAIL — `Cannot find module '../export-library'`.

- [ ] **Step 3: Write `export-library.ts`**

Create `src/features/library/actions/export-library.ts`:

```ts
import { createArchive } from "@/services/backup/backup-archive";
import {
  BACKUP_VERSION,
  type BackupData,
  type PreferencesSnapshot,
} from "@/services/backup/backup-types";
import { getAllBooks, getBookCover } from "@/services/storage/book-repository";
import { getBookFile } from "@/services/storage/book-files";
import {
  getMembersForGrouping,
  listGroupings,
} from "@/services/storage/groupings";
import { preferencesStore } from "@/features/preferences/store/preferences-store";
import { logger as rootLogger } from "@/shared/logger/logger";

const logger = rootLogger.child("export-library");

function snapshotPreferences(): PreferencesSnapshot {
  const s = preferencesStore.getState();
  return {
    theme: s.theme,
    applyThemeToReader: s.applyThemeToReader,
    readerFont: s.readerFont,
    readerTheme: s.readerTheme,
    fontScale: s.fontScale,
    lineHeight: s.lineHeight,
    margins: s.margins,
    paragraphSpacing: s.paragraphSpacing,
    keepScreenAwake: s.keepScreenAwake,
    keepScreenAwakeMinutes: s.keepScreenAwakeMinutes,
  };
}

export async function exportLibrary(): Promise<Blob> {
  const books = await getAllBooks();

  const files = new Map<string, Blob>();
  const covers = new Map<string, Blob>();

  for (const book of books) {
    const stored = await getBookFile(book.id);
    if (stored) {
      files.set(book.id, stored.file);
    } else {
      // ponytail: a book with no readable file still ships in the manifest;
      // readArchive treats the missing books/<id>.epub as a skip on restore.
      logger.error(`no file for book ${book.id}; exported without its EPUB`);
    }

    const cover = await getBookCover(book.id);
    if (cover) covers.set(book.id, cover.cover);
  }

  const groupings = await listGroupings();
  const groupingMembers = (
    await Promise.all(groupings.map((g) => getMembersForGrouping(g.id)))
  ).flat();

  const data: BackupData = {
    manifest: {
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      books,
      groupings,
      groupingMembers,
      preferences: snapshotPreferences(),
    },
    files,
    covers,
  };

  return createArchive(data);
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `pnpm test:run src/features/library/actions/__tests__/export-library.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/library/actions/export-library.ts src/features/library/actions/__tests__/export-library.test.ts
git commit -m "$(cat <<'EOF'
feat(backup): exportLibrary — whole library into one archive

Reads every book/file/cover/grouping from storage, snapshots the ten
persisted preference keys, and packs them via createArchive.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: STOP** — wait for go-ahead before Task 3.

---

## Task 3: Reset library (`reset-library.ts`)

**Files:**

- Create: `src/features/library/actions/reset-library.ts`
- Test: `src/features/library/actions/__tests__/reset-library.test.ts`

**Interfaces:**

- Consumes:
  - `db` from `@/services/storage/db` (tables: `books`, `bookFiles`, `bookCovers`, `searchIndex`, `chapterText`, `groupings`, `groupingMembers`)
  - `deleteOpfsFile` from `@/services/storage/opfs-files`
  - `revokeCoverUrl` from `@/services/storage/cover-cache`
  - `libraryStore` from `../store/library-store` (`setBooks`, `setEvicted`)
  - `pwaStore` from `@/features/pwa/store/pwa-store` (`setHadBooks`)
- Produces: `resetLibrary(): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/features/library/actions/__tests__/reset-library.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { db } from "@/services/storage/db";
import { libraryStore } from "@/features/library/store/library-store";
import { pwaStore } from "@/features/pwa/store/pwa-store";
import { importBook } from "../import-book";
import { createCollection, addBookToCollection } from "../collections";
import { resetLibrary } from "../reset-library";

beforeEach(async () => {
  await resetTestDb();
});

describe("resetLibrary", () => {
  it("empties every table and resets the library stores", async () => {
    const { id, indexed } = await importBook(
      await loadFixture("valid-book.epub"),
    );
    await indexed;
    const c = await createCollection("Favorites");
    await addBookToCollection(c, id);
    libraryStore.getState().setBooks([{ id } as never]);
    pwaStore.getState().setHadBooks(true);

    await resetLibrary();

    for (const table of [
      db.books,
      db.bookFiles,
      db.bookCovers,
      db.searchIndex,
      db.chapterText,
      db.groupings,
      db.groupingMembers,
    ]) {
      expect(await table.count()).toBe(0);
    }
    expect(libraryStore.getState().books).toEqual([]);
    expect(pwaStore.getState().hadBooks).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `pnpm test:run src/features/library/actions/__tests__/reset-library.test.ts`
Expected: FAIL — `Cannot find module '../reset-library'`.

- [ ] **Step 3: Write `reset-library.ts`**

Create `src/features/library/actions/reset-library.ts`:

```ts
import { db } from "@/services/storage/db";
import { revokeCoverUrl } from "@/services/storage/cover-cache";
import { deleteOpfsFile } from "@/services/storage/opfs-files";
import { pwaStore } from "@/features/pwa/store/pwa-store";
import { libraryStore } from "../store/library-store";

/**
 * Wipes the library: every table, every OPFS file, cached cover URLs, and
 * the in-memory library stores. Preferences and PWA/install flags survive
 * (except `hadBooks`) — this resets the library, not the app. `hadBooks` is
 * cleared so the empty library reads as first-run, not browser eviction.
 */
export async function resetLibrary(): Promise<void> {
  const books = await db.books.toArray();

  // OPFS lives outside Dexie's transaction scope — do it first, per book,
  // while we still have the ids. deleteOpfsFile already fails soft.
  for (const book of books) {
    revokeCoverUrl(book.id);
    await deleteOpfsFile(book.id);
  }

  await db.transaction(
    "rw",
    [
      db.books,
      db.bookFiles,
      db.bookCovers,
      db.searchIndex,
      db.chapterText,
      db.groupings,
      db.groupingMembers,
    ],
    async () => {
      await Promise.all([
        db.books.clear(),
        db.bookFiles.clear(),
        db.bookCovers.clear(),
        db.searchIndex.clear(),
        db.chapterText.clear(),
        db.groupings.clear(),
        db.groupingMembers.clear(),
      ]);
    },
  );

  libraryStore.getState().setBooks([]);
  libraryStore.getState().setEvicted(false);
  pwaStore.getState().setHadBooks(false);
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `pnpm test:run src/features/library/actions/__tests__/reset-library.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/library/actions/reset-library.ts src/features/library/actions/__tests__/reset-library.test.ts
git commit -m "$(cat <<'EOF'
feat(backup): resetLibrary — wipe all library data

Clears the seven Dexie tables + OPFS files + cached cover URLs and resets
the library stores. Preferences and install flags are left alone.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: STOP** — wait for go-ahead before Task 4.

---

## Task 4: Import a backup (`import-backup.ts`)

**Files:**

- Create: `src/features/library/actions/import-backup.ts`
- Test: `src/features/library/actions/__tests__/import-backup.test.ts`

**Interfaces:**

- Consumes:
  - Task 1: `readArchive`, `BackupFormatError`, `BackupData`, `PreferencesSnapshot`
  - `getBookByFileHash` from `@/services/storage/book-repository`
  - `saveImportedBook`, `updateBookProgress`, `updateBookManualStatus` from `@/services/storage/book-repository`
  - `listGroupings`, `getMembersForGrouping` from `@/services/storage/groupings`
  - `ensureSeriesGroupings` from `@/services/storage/groupings`
  - `createCollection`, `addBookToCollection` from `./collections`
  - `createId` from `@/utils/create-id`
  - `preferencesStore` from `@/features/preferences/store/preferences-store`
  - `logger` from `@/shared/logger/logger`
  - dynamic `import("@/services/search/search-service")` → `buildIndex(bookId, file: Blob)`
  - `StoredBook`, `GroupingMember` from `@/services/storage/storage-types`
- Produces:
  - `interface ProgressConflict { localId: string; title: string; localChapter: number; localTotal: number; backupChapter: number; backupTotal: number }`
  - `type ConflictResolution = "keep" | "take-backup"`
  - `interface ApplyBackupSummary { restored: number; skipped: number; conflictsResolved: number; failed: number }`
  - `interface ReadBackupResult { data: BackupData; conflicts: ProgressConflict[] }`
  - `readBackup(file: Blob): Promise<ReadBackupResult>` — re-throws `BackupFormatError`
  - `applyBackup(data: BackupData, resolutions: Map<string, ConflictResolution>): Promise<ApplyBackupSummary>` — `resolutions` keyed by `ProgressConflict.localId`

- [ ] **Step 1: Write the failing test**

Create `src/features/library/actions/__tests__/import-backup.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { db } from "@/services/storage/db";
import { getAllBooks } from "@/services/storage/book-repository";
import { getBookFile } from "@/services/storage/book-files";
import { updateBookProgress } from "@/services/storage/book-repository";
import { listGroupings } from "@/services/storage/groupings";
import { preferencesStore } from "@/features/preferences/store/preferences-store";
import { importBook } from "../import-book";
import { createCollection, addBookToCollection } from "../collections";
import { exportLibrary } from "../export-library";
import { resetLibrary } from "../reset-library";
import { readBackup, applyBackup } from "../import-backup";

const buildIndex = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/services/search/search-service", () => ({ buildIndex }));

beforeEach(async () => {
  await resetTestDb();
  buildIndex.mockClear();
  localStorage.clear();
});

async function archiveOf(setup: () => Promise<void>): Promise<Blob> {
  await setup();
  const blob = await exportLibrary();
  await resetLibrary();
  return blob;
}

describe("readBackup + applyBackup", () => {
  it("restores books, files, and collections onto an empty library", async () => {
    let bookId = "";
    const archive = await archiveOf(async () => {
      const r = await importBook(await loadFixture("valid-book.epub"));
      bookId = r.id;
      const c = await createCollection("Favorites");
      await addBookToCollection(c, bookId);
    });

    const { data, conflicts } = await readBackup(archive);
    expect(conflicts).toEqual([]);
    const summary = await applyBackup(data, new Map());

    expect(summary.restored).toBe(1);
    const books = await getAllBooks();
    expect(books).toHaveLength(1);
    expect(books[0].id).not.toBe(bookId); // fresh id
    expect(await getBookFile(books[0].id)).toBeTruthy();
    expect((await listGroupings("collection"))[0]?.name).toBe("Favorites");
    expect(buildIndex).toHaveBeenCalledTimes(1);
  });

  it("skips a book already present at the same chapter", async () => {
    const archive = await archiveOf(async () => {
      await importBook(await loadFixture("valid-book.epub"));
    });
    await importBook(await loadFixture("valid-book.epub")); // same file, local

    const { data } = await readBackup(archive);
    const summary = await applyBackup(data, new Map());

    expect(summary.skipped).toBe(1);
    expect(summary.restored).toBe(0);
    expect(await getAllBooks()).toHaveLength(1);
  });

  it("reports a chapter-level progress conflict and applies the chosen side", async () => {
    let archiveBookId = "";
    const archive = await archiveOf(async () => {
      const r = await importBook(await loadFixture("valid-book.epub"));
      archiveBookId = r.id;
      await updateBookProgress(archiveBookId, {
        chapterIndex: 5,
        totalChapters: 10,
        scrollFraction: 0,
        anchorPath: null,
        atDocumentEnd: false,
        percent: 50,
        updatedAt: Date.now(),
      });
    });
    const local = await importBook(await loadFixture("valid-book.epub"));

    const { data, conflicts } = await readBackup(archive);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      localId: local.id,
      backupChapter: 5,
      localChapter: 0,
    });

    await applyBackup(data, new Map([[conflicts[0].localId, "take-backup"]]));
    const [book] = await getAllBooks();
    expect(book.progress?.chapterIndex).toBe(5);
  });

  it("keeps local progress when the conflict is resolved 'keep'", async () => {
    const archive = await archiveOf(async () => {
      const r = await importBook(await loadFixture("valid-book.epub"));
      await updateBookProgress(r.id, {
        chapterIndex: 5,
        totalChapters: 10,
        scrollFraction: 0,
        anchorPath: null,
        atDocumentEnd: false,
        percent: 50,
        updatedAt: Date.now(),
      });
    });
    const local = await importBook(await loadFixture("valid-book.epub"));

    const { data, conflicts } = await readBackup(archive);
    await applyBackup(data, new Map([[conflicts[0].localId, "keep"]]));

    const [book] = await getAllBooks();
    expect(book.progress?.chapterIndex).toBe(0);
  });

  it("applies preferences only when none are stored locally", async () => {
    const archive = await archiveOf(async () => {
      await importBook(await loadFixture("valid-book.epub"));
      preferencesStore.getState().setFontScale(1.4);
    });
    // export wrote librune-preferences; simulate a fresh device
    localStorage.removeItem("librune-preferences");
    preferencesStore.setState({ fontScale: 1 });

    const { data } = await readBackup(archive);
    await applyBackup(data, new Map());
    expect(preferencesStore.getState().fontScale).toBe(1.4);
  });

  it("does not touch preferences when they are stored locally", async () => {
    const archive = await archiveOf(async () => {
      await importBook(await loadFixture("valid-book.epub"));
      preferencesStore.getState().setFontScale(1.4);
    });
    localStorage.setItem("librune-preferences", "{}");
    preferencesStore.setState({ fontScale: 1 });

    const { data } = await readBackup(archive);
    await applyBackup(data, new Map());
    expect(preferencesStore.getState().fontScale).toBe(1);
  });

  it("counts a book whose file entry is missing as failed", async () => {
    const archive = await archiveOf(async () => {
      await importBook(await loadFixture("valid-book.epub"));
    });
    const { data } = await readBackup(archive);
    data.files.clear();

    const summary = await applyBackup(data, new Map());
    expect(summary.failed).toBe(1);
    expect(summary.restored).toBe(0);
  });

  it("re-throws a format error from a bad file", async () => {
    await expect(readBackup(new Blob(["nope"]))).rejects.toThrow(
      /isn't a Librune backup/,
    );
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `pnpm test:run src/features/library/actions/__tests__/import-backup.test.ts`
Expected: FAIL — `Cannot find module '../import-backup'`.

- [ ] **Step 3: Write `import-backup.ts`**

Create `src/features/library/actions/import-backup.ts`:

```ts
import { readArchive } from "@/services/backup/backup-archive";
import type {
  BackupData,
  PreferencesSnapshot,
} from "@/services/backup/backup-types";
import {
  getBookByFileHash,
  saveImportedBook,
  updateBookManualStatus,
  updateBookProgress,
} from "@/services/storage/book-repository";
import {
  ensureSeriesGroupings,
  getMembersForGrouping,
  listGroupings,
} from "@/services/storage/groupings";
import type {
  GroupingMember,
  StoredBook,
} from "@/services/storage/storage-types";
import { preferencesStore } from "@/features/preferences/store/preferences-store";
import { createId } from "@/utils/create-id";
import { logger as rootLogger } from "@/shared/logger/logger";
import { addBookToCollection, createCollection } from "./collections";

const logger = rootLogger.child("import-backup");

const PREFERENCES_KEY = "librune-preferences";

export interface ProgressConflict {
  localId: string;
  title: string;
  localChapter: number;
  localTotal: number;
  backupChapter: number;
  backupTotal: number;
}

export type ConflictResolution = "keep" | "take-backup";

export interface ApplyBackupSummary {
  restored: number;
  skipped: number;
  conflictsResolved: number;
  failed: number;
}

export interface ReadBackupResult {
  data: BackupData;
  conflicts: ProgressConflict[];
}

function chapterOf(book: Pick<StoredBook, "progress">): number {
  return book.progress?.chapterIndex ?? 0;
}

function totalOf(book: StoredBook): number {
  return book.progress?.totalChapters ?? book.chapterCount ?? 0;
}

async function detectConflicts(data: BackupData): Promise<ProgressConflict[]> {
  const conflicts: ProgressConflict[] = [];
  for (const book of data.manifest.books) {
    const local = await getBookByFileHash(book.fileHash);
    if (!local) continue;
    if (chapterOf(local) === chapterOf(book)) continue;
    conflicts.push({
      localId: local.id,
      title: local.title,
      localChapter: chapterOf(local),
      localTotal: totalOf(local),
      backupChapter: chapterOf(book),
      backupTotal: totalOf(book),
    });
  }
  return conflicts;
}

export async function readBackup(file: Blob): Promise<ReadBackupResult> {
  const data = await readArchive(file); // throws BackupFormatError
  return { data, conflicts: await detectConflicts(data) };
}

export async function applyBackup(
  data: BackupData,
  resolutions: Map<string, ConflictResolution>,
): Promise<ApplyBackupSummary> {
  const summary: ApplyBackupSummary = {
    restored: 0,
    skipped: 0,
    conflictsResolved: 0,
    failed: 0,
  };

  const archiveToLocal = new Map<string, string>();
  const newlyRestored: Array<{ localId: string; file: Blob }> = [];

  for (const book of data.manifest.books) {
    try {
      const local = await getBookByFileHash(book.fileHash);

      if (local) {
        archiveToLocal.set(book.id, local.id);
        const differs = chapterOf(local) !== chapterOf(book);
        if (differs && resolutions.get(local.id) === "take-backup") {
          if (book.progress) await updateBookProgress(local.id, book.progress);
          if (book.manualStatus) {
            await updateBookManualStatus(local.id, book.manualStatus);
          }
          summary.conflictsResolved += 1;
        } else {
          summary.skipped += 1;
        }
        continue;
      }

      const file = data.files.get(book.id);
      if (!file) {
        summary.failed += 1;
        continue;
      }

      const localId = createId();
      const restored: StoredBook = { ...book, id: localId };
      await saveImportedBook({
        metadata: restored,
        file,
        cover: data.covers.get(book.id),
      });
      archiveToLocal.set(book.id, localId);
      newlyRestored.push({ localId, file });
      summary.restored += 1;
    } catch (error) {
      logger.error(`failed to restore book ${book.id}`, error);
      summary.failed += 1;
    }
  }

  await restoreCollections(data, archiveToLocal);

  try {
    await ensureSeriesGroupings([...archiveToLocal.values()]);
  } catch (error) {
    logger.error("series backfill after restore failed", error);
  }

  applyPreferences(data.manifest.preferences);

  // Background, fire-and-forget — mirrors importBook. A failed index build
  // never fails the restore; the lazy backfill retries on next search.
  for (const { localId, file } of newlyRestored) {
    void import("@/services/search/search-service")
      .then(({ buildIndex }) => buildIndex(localId, file))
      .catch((error: unknown) => {
        logger.error(`failed to index restored book ${localId}`, error);
      });
  }

  return summary;
}

async function restoreCollections(
  data: BackupData,
  archiveToLocal: Map<string, string>,
): Promise<void> {
  const collections = data.manifest.groupings.filter(
    (g) => g.type === "collection",
  );
  if (collections.length === 0) return;

  const byName = new Map(
    (await listGroupings("collection")).map((g) => [
      g.name.toLowerCase(),
      g.id,
    ]),
  );

  const membersByGrouping = new Map<string, GroupingMember[]>();
  for (const member of data.manifest.groupingMembers) {
    const list = membersByGrouping.get(member.groupingId) ?? [];
    list.push(member);
    membersByGrouping.set(member.groupingId, list);
  }

  for (const collection of collections) {
    try {
      let localGroupingId = byName.get(collection.name.toLowerCase());
      if (!localGroupingId) {
        localGroupingId = await createCollection(collection.name);
        byName.set(collection.name.toLowerCase(), localGroupingId);
      }

      const already = new Set(
        (await getMembersForGrouping(localGroupingId)).map((m) => m.bookId),
      );

      for (const member of membersByGrouping.get(collection.id) ?? []) {
        const localBookId = await resolveLocalBookId(
          member.bookId,
          archiveToLocal,
          data,
        );
        if (!localBookId || already.has(localBookId)) continue;
        await addBookToCollection(localGroupingId, localBookId);
        already.add(localBookId);
      }
    } catch (error) {
      logger.error(`failed to restore collection "${collection.name}"`, error);
    }
  }
}

async function resolveLocalBookId(
  archiveBookId: string,
  archiveToLocal: Map<string, string>,
  data: BackupData,
): Promise<string | undefined> {
  const mapped = archiveToLocal.get(archiveBookId);
  if (mapped) return mapped;
  const archiveBook = data.manifest.books.find((b) => b.id === archiveBookId);
  if (!archiveBook) return undefined;
  const local = await getBookByFileHash(archiveBook.fileHash);
  return local?.id;
}

/** Apply the snapshot only on a genuinely fresh device — no persisted
 * preferences at all. Otherwise the device's own preferences win, in full
 * (spec decision 5). Best-effort: logged, never toasted. */
function applyPreferences(snapshot: PreferencesSnapshot): void {
  try {
    if (localStorage.getItem(PREFERENCES_KEY) !== null) return;
  } catch {
    return;
  }
  try {
    const s = preferencesStore.getState();
    s.setTheme(snapshot.theme);
    s.setApplyThemeToReader(snapshot.applyThemeToReader);
    s.setReaderFont(snapshot.readerFont);
    s.setReaderTheme(snapshot.readerTheme);
    s.setFontScale(snapshot.fontScale);
    s.setLineHeight(snapshot.lineHeight);
    s.setMargins(snapshot.margins);
    s.setParagraphSpacing(snapshot.paragraphSpacing);
    s.setKeepScreenAwake(snapshot.keepScreenAwake);
    s.setKeepScreenAwakeMinutes(snapshot.keepScreenAwakeMinutes);
  } catch (error) {
    logger.error("failed to apply preferences from backup", error);
  }
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `pnpm test:run src/features/library/actions/__tests__/import-backup.test.ts`
Expected: PASS (8 tests). If the "applies preferences only when none are stored locally" test is flaky because the `persist` middleware re-writes the key when `setState` runs, move the `localStorage.removeItem` to _after_ the `preferencesStore.setState({ fontScale: 1 })` line — the mechanism under test is "key absent at `applyBackup` time".

- [ ] **Step 5: Commit**

```bash
git add src/features/library/actions/import-backup.ts src/features/library/actions/__tests__/import-backup.test.ts
git commit -m "$(cat <<'EOF'
feat(backup): importBackup — merge an archive back into the library

fileHash-keyed merge: unknown books restored with fresh ids + background
index build, known books skipped unless a chapter-level progress conflict
is resolved "take-backup". Collections recreated by name; series re-derived
via ensureSeriesGroupings. Preferences applied only on a fresh device.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: STOP** — wait for go-ahead before Task 5.

---

## Task 5: Download helper + `useBackup` hook

**Files:**

- Create: `src/utils/download-blob.ts`
- Test: `src/utils/__tests__/download-blob.test.ts`
- Create: `src/features/library/hooks/use-backup.ts`
- Test: `src/features/library/hooks/__tests__/use-backup.test.ts`

**Interfaces:**

- Consumes:
  - Task 2: `exportLibrary`
  - Task 4: `readBackup`, `applyBackup`, `ProgressConflict`, `ConflictResolution`, `ApplyBackupSummary`
  - `BackupFormatError` from `@/services/backup/backup-types`
  - `loadLibrary` from `../actions/load-library` (relative from the hook: `@/features/library/actions/load-library`)
  - `notify` from `@/components/toast/toast`
  - `logger` from `@/shared/logger/logger`
- Produces:
  - `downloadBlob(blob: Blob, filename: string): void`
  - `useBackup()` returning:
    - `exporting: boolean`, `importing: boolean`
    - `conflicts: ProgressConflict[] | null` — non-null while the conflict dialog should be open
    - `exportNow(): Promise<void>`
    - `importFile(file: File): Promise<void>`
    - `resolveConflicts(resolutions: Map<string, ConflictResolution>): Promise<void>`
    - `cancelImport(): void`

- [ ] **Step 1: Write the failing test for `downloadBlob`**

Create `src/utils/__tests__/download-blob.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "../download-blob";

afterEach(() => vi.restoreAllMocks());

describe("downloadBlob", () => {
  it("clicks a synthesized download anchor and revokes the URL", () => {
    const createURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:fake");
    const revokeURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    downloadBlob(new Blob(["x"]), "librune-backup.zip");

    expect(createURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeURL).toHaveBeenCalledWith("blob:fake");
    expect(document.querySelector("a")).toBeNull(); // cleaned up
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `pnpm test:run src/utils/__tests__/download-blob.test.ts`
Expected: FAIL — `Cannot find module '../download-blob'`.

- [ ] **Step 3: Write `download-blob.ts`**

Create `src/utils/download-blob.ts`:

```ts
/**
 * Trigger a browser download of an in-memory Blob. Object-URL + a
 * synthesized <a download> click is the only portable way — there is no
 * imperative "save this blob" API. The anchor never renders (removed
 * synchronously); the URL is revoked right after the click.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `pnpm test:run src/utils/__tests__/download-blob.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `useBackup`**

Create `src/features/library/hooks/__tests__/use-backup.test.ts`:

```ts
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBackup } from "../use-backup";

const exportLibrary = vi.hoisted(() => vi.fn());
const readBackup = vi.hoisted(() => vi.fn());
const applyBackup = vi.hoisted(() => vi.fn());
const loadLibrary = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const downloadBlob = vi.hoisted(() => vi.fn());
const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("../../actions/export-library", () => ({ exportLibrary }));
vi.mock("../../actions/import-backup", () => ({ readBackup, applyBackup }));
vi.mock("@/features/library/actions/load-library", () => ({ loadLibrary }));
vi.mock("@/utils/download-blob", () => ({ downloadBlob }));
vi.mock("@/components/toast/toast", () => ({ notify }));

function fakeFile() {
  return new File(["zip"], "b.zip", { type: "application/zip" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useBackup", () => {
  it("exports and triggers a download", async () => {
    exportLibrary.mockResolvedValue(new Blob(["zip"]));
    const { result } = renderHook(() => useBackup());

    await act(() => result.current.exportNow());

    expect(downloadBlob).toHaveBeenCalledOnce();
    expect(notify.success).toHaveBeenCalledWith("Backup saved");
  });

  it("imports with no conflicts in one step", async () => {
    readBackup.mockResolvedValue({ data: { manifest: {} }, conflicts: [] });
    applyBackup.mockResolvedValue({
      restored: 2,
      skipped: 0,
      conflictsResolved: 0,
      failed: 0,
    });
    const { result } = renderHook(() => useBackup());

    await act(() => result.current.importFile(fakeFile()));

    expect(applyBackup).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Map),
    );
    expect(loadLibrary).toHaveBeenCalledOnce();
    expect(notify.success).toHaveBeenCalled();
  });

  it("pauses on conflicts and resumes with resolutions", async () => {
    const conflicts = [
      {
        localId: "l1",
        title: "T",
        localChapter: 0,
        localTotal: 10,
        backupChapter: 4,
        backupTotal: 10,
      },
    ];
    readBackup.mockResolvedValue({ data: { manifest: {} }, conflicts });
    applyBackup.mockResolvedValue({
      restored: 0,
      skipped: 0,
      conflictsResolved: 1,
      failed: 0,
    });
    const { result } = renderHook(() => useBackup());

    await act(() => result.current.importFile(fakeFile()));
    expect(result.current.conflicts).toEqual(conflicts);
    expect(applyBackup).not.toHaveBeenCalled();

    await act(() =>
      result.current.resolveConflicts(new Map([["l1", "take-backup"]])),
    );
    expect(applyBackup).toHaveBeenCalledWith(
      expect.anything(),
      new Map([["l1", "take-backup"]]),
    );
    await waitFor(() => expect(result.current.conflicts).toBeNull());
  });

  it("shows the format-error message verbatim", async () => {
    const { BackupFormatError } =
      await import("@/services/backup/backup-types");
    readBackup.mockRejectedValue(
      new BackupFormatError("This file isn't a Librune backup."),
    );
    const { result } = renderHook(() => useBackup());

    await act(() => result.current.importFile(fakeFile()));

    expect(notify.error).toHaveBeenCalledWith(
      "This file isn't a Librune backup.",
    );
  });
});
```

- [ ] **Step 6: Run it, confirm it fails**

Run: `pnpm test:run src/features/library/hooks/__tests__/use-backup.test.ts`
Expected: FAIL — `Cannot find module '../use-backup'`.

- [ ] **Step 7: Write `use-backup.ts`**

Create `src/features/library/hooks/use-backup.ts`:

```ts
import { useCallback, useRef, useState } from "react";
import { notify } from "@/components/toast/toast";
import { BackupFormatError } from "@/services/backup/backup-types";
import type { BackupData } from "@/services/backup/backup-types";
import { downloadBlob } from "@/utils/download-blob";
import { logger as rootLogger } from "@/shared/logger/logger";
import { loadLibrary } from "@/features/library/actions/load-library";
import { exportLibrary } from "../actions/export-library";
import {
  applyBackup,
  readBackup,
  type ApplyBackupSummary,
  type ConflictResolution,
  type ProgressConflict,
} from "../actions/import-backup";

const logger = rootLogger.child("use-backup");

function backupFilename(): string {
  return `librune-backup-${new Date().toISOString().replace(/:/g, "-")}.zip`;
}

function summarize(s: ApplyBackupSummary): string {
  const parts = [`${s.restored} added`];
  if (s.conflictsResolved) parts.push(`${s.conflictsResolved} updated`);
  if (s.skipped) parts.push(`${s.skipped} already present`);
  if (s.failed) parts.push(`${s.failed} skipped`);
  return `Backup restored — ${parts.join(", ")}`;
}

export function useBackup() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [conflicts, setConflicts] = useState<ProgressConflict[] | null>(null);
  const pending = useRef<BackupData | null>(null);

  const exportNow = useCallback(async () => {
    setExporting(true);
    try {
      downloadBlob(await exportLibrary(), backupFilename());
      notify.success("Backup saved");
    } catch (error) {
      logger.error("export failed", error);
      notify.error("Couldn't create the backup. Try again.");
    } finally {
      setExporting(false);
    }
  }, []);

  const finish = useCallback(
    async (data: BackupData, resolutions: Map<string, ConflictResolution>) => {
      try {
        const summary = await applyBackup(data, resolutions);
        await loadLibrary();
        notify.success(summarize(summary));
      } catch (error) {
        logger.error("applyBackup failed", error);
        notify.error("Something went wrong restoring the backup.");
      } finally {
        setImporting(false);
      }
    },
    [],
  );

  const importFile = useCallback(
    async (file: File) => {
      setImporting(true);
      try {
        const { data, conflicts: found } = await readBackup(file);
        if (found.length > 0) {
          pending.current = data;
          setConflicts(found);
          return; // wait for resolveConflicts / cancelImport
        }
        await finish(data, new Map());
      } catch (error) {
        if (error instanceof BackupFormatError) {
          notify.error(error.message);
        } else {
          logger.error("import failed", error);
          notify.error("Couldn't read that backup file.");
        }
        setImporting(false);
      }
    },
    [finish],
  );

  const resolveConflicts = useCallback(
    async (resolutions: Map<string, ConflictResolution>) => {
      const data = pending.current;
      pending.current = null;
      setConflicts(null);
      if (!data) {
        setImporting(false);
        return;
      }
      await finish(data, resolutions);
    },
    [finish],
  );

  const cancelImport = useCallback(() => {
    pending.current = null;
    setConflicts(null);
    setImporting(false);
  }, []);

  return {
    exporting,
    importing,
    conflicts,
    exportNow,
    importFile,
    resolveConflicts,
    cancelImport,
  };
}
```

- [ ] **Step 8: Run both test files, confirm they pass**

Run: `pnpm test:run src/utils/__tests__/download-blob.test.ts src/features/library/hooks/__tests__/use-backup.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/utils/download-blob.ts src/utils/__tests__/download-blob.test.ts src/features/library/hooks/use-backup.ts src/features/library/hooks/__tests__/use-backup.test.ts
git commit -m "$(cat <<'EOF'
feat(backup): downloadBlob util + useBackup hook

useBackup drives export (download) and import (read -> optional conflict
pause -> apply -> reload), surfacing BackupFormatError messages verbatim.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 10: STOP** — wait for go-ahead before Task 6.

---

## Task 6: Settings UI — Backup & Restore section, conflict dialog, Reset row

**Files:**

- Create: `src/features/library/components/backup-conflict-dialog.tsx`
- Modify: `src/app/screens/settings/settings-screen.tsx`
- Modify: `src/app/screens/settings/__tests__/settings-screen.test.tsx`

**Interfaces:**

- Consumes:
  - Task 5: `useBackup`
  - Task 4: `ProgressConflict`, `ConflictResolution`
  - `AlertDialog*` from `@/components/ui/alert-dialog`
  - `RadioGroup`, `RadioGroupItem` from `@/components/ui/radio-group`
  - `Button` from `@/components/ui/button`
  - `ConfirmDeleteDialog` from `@/features/library/components/confirm-delete-dialog` (props: `open`, `title`, `description`, `onConfirm: () => void | Promise<void>`, `onOpenChange`)
  - `resetLibrary` from `@/features/library/actions/reset-library`
  - `notify` from `@/components/toast/toast`
  - Phosphor icons: `ArchiveBoxIcon`, `DownloadSimpleIcon` (already imported), `UploadSimpleIcon`, `TrashIcon`, `SpinnerIcon`
- Produces:
  - `BackupConflictDialog` — props `{ conflicts: ProgressConflict[]; onApply: (r: Map<string, ConflictResolution>) => void; onCancel: () => void }`. Open whenever `conflicts` is a non-empty array (caller controls mount).

- [ ] **Step 1: Write the failing test for `BackupConflictDialog`**

Create `src/features/library/components/__tests__/backup-conflict-dialog.test.tsx`:

```ts
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BackupConflictDialog } from "../backup-conflict-dialog";

const conflicts = [
  {
    localId: "l1",
    title: "Anna Karenina",
    localChapter: 3,
    localTotal: 20,
    backupChapter: 7,
    backupTotal: 20,
  },
];

describe("BackupConflictDialog", () => {
  it("defaults every book to 'keep' and applies choices", async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(
      <BackupConflictDialog
        conflicts={conflicts}
        onApply={onApply}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/Anna Karenina/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /apply/i }));
    expect(onApply).toHaveBeenCalledWith(new Map([["l1", "keep"]]));
  });

  it("records a per-book 'use backup' choice", async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(
      <BackupConflictDialog
        conflicts={conflicts}
        onApply={onApply}
        onCancel={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("radio", { name: /use backup.*chapter 7/i }),
    );
    await user.click(screen.getByRole("button", { name: /apply/i }));
    expect(onApply).toHaveBeenCalledWith(new Map([["l1", "take-backup"]]));
  });

  it("cancels", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <BackupConflictDialog
        conflicts={conflicts}
        onApply={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `pnpm test:run src/features/library/components/__tests__/backup-conflict-dialog.test.tsx`
Expected: FAIL — `Cannot find module '../backup-conflict-dialog'`.

- [ ] **Step 3: Write `backup-conflict-dialog.tsx`**

Create `src/features/library/components/backup-conflict-dialog.tsx`:

```tsx
import { useState, type FC } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import type {
  ConflictResolution,
  ProgressConflict,
} from "@/features/library/actions/import-backup";

interface Props {
  conflicts: ProgressConflict[];
  onApply: (resolutions: Map<string, ConflictResolution>) => void;
  onCancel: () => void;
}

/**
 * Shown when a backup being imported has books already in the library at a
 * different chapter. One row per book, defaulting to "keep this device's".
 * Nothing is written until Apply — Cancel aborts the whole import.
 */
export const BackupConflictDialog: FC<Props> = ({
  conflicts,
  onApply,
  onCancel,
}) => {
  const [choices, setChoices] = useState<Map<string, ConflictResolution>>(
    () => new Map(conflicts.map((c) => [c.localId, "keep"])),
  );

  const set = (localId: string, value: ConflictResolution) =>
    setChoices((prev) => new Map(prev).set(localId, value));

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Some books are at a different point
          </AlertDialogTitle>
          <AlertDialogDescription>
            These books are already in your library. Choose which reading
            position to keep for each.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto">
          {conflicts.map((c) => (
            <div key={c.localId} className="flex flex-col gap-2">
              <span className="text-ui font-semibold text-foreground">
                {c.title}
              </span>
              <RadioGroup
                value={choices.get(c.localId)}
                onValueChange={(v) => set(c.localId, v as ConflictResolution)}
              >
                <label className="flex items-center gap-2 text-ui-sm">
                  <RadioGroupItem value="keep" />
                  Keep this device&apos;s — chapter {c.localChapter + 1} of{" "}
                  {c.localTotal}
                </label>
                <label className="flex items-center gap-2 text-ui-sm">
                  <RadioGroupItem value="take-backup" />
                  Use backup&apos;s — chapter {c.backupChapter + 1} of{" "}
                  {c.backupTotal}
                </label>
              </RadioGroup>
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onApply(choices)}>Apply</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
```

Note on the radio API: `@base-ui/react`'s `RadioGroup` uses `value` / `onValueChange`. If the generated wrapper in this repo differs (check `src/components/ui/radio-group.tsx` — it re-exports the Base UI `RadioGroup` primitive directly), match whatever prop names that primitive exposes; the `font-selector.tsx` consumer is the reference. Chapter numbers are shown 1-based (`+ 1`) for humans; `chapterIndex` is 0-based internally.

- [ ] **Step 4: Run it, confirm it passes**

Run: `pnpm test:run src/features/library/components/__tests__/backup-conflict-dialog.test.tsx`
Expected: PASS. If `getByRole("radio", …)` name matching fails, wrap each option's text in the `<label>` and rely on the `label` association, or add `aria-label` to the `RadioGroupItem`.

- [ ] **Step 5: Write the failing settings-screen test additions**

In `src/app/screens/settings/__tests__/settings-screen.test.tsx`, add inside `describe("SettingsScreen", …)`:

```ts
it("renders the Backup & Restore controls", () => {
  renderScreen();
  expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /restore from a backup/i }),
  ).toBeInTheDocument();
});

it("opens the reset confirmation dialog", async () => {
  const user = userEvent.setup();
  renderScreen();

  await user.click(screen.getByRole("button", { name: /delete all books/i }));
  expect(
    screen.getByRole("alertdialog", { name: /delete all books/i }),
  ).toBeInTheDocument();
});
```

- [ ] **Step 6: Run it, confirm the new tests fail**

Run: `pnpm test:run src/app/screens/settings/__tests__/settings-screen.test.tsx`
Expected: the two new tests FAIL (buttons not found); existing tests still pass.

- [ ] **Step 7: Wire the Settings screen**

In `src/app/screens/settings/settings-screen.tsx`:

7a. Add icon imports to the existing `@phosphor-icons/react` import:
`ArchiveBoxIcon`, `UploadSimpleIcon`, `TrashIcon`, `SpinnerIcon`.

7b. Add hook imports near the other feature-hook imports:

```ts
import { useRef, useState } from "react";
import { useBackup } from "@/features/library/hooks/use-backup";
import { resetLibrary } from "@/features/library/actions/reset-library";
import { BackupConflictDialog } from "@/features/library/components/backup-conflict-dialog";
import { ConfirmDeleteDialog } from "@/features/library/components/confirm-delete-dialog";
```

(Merge the `useRef`/`useState` into the existing `react` import if present.)

7c. Inside `SettingsScreen`, after the existing hook calls:

```ts
const {
  exporting,
  importing,
  conflicts,
  exportNow,
  importFile,
  resolveConflicts,
  cancelImport,
} = useBackup();
const fileInputRef = useRef<HTMLInputElement>(null);
const [resetOpen, setResetOpen] = useState(false);

const handleReset = async () => {
  await resetLibrary();
  notify.success("Library cleared");
};
```

7d. Add a **"Delete all books & data"** row as the last child of the existing Storage section's `<div className="flex flex-col divide-y …">`, right after the Diagnostics row:

```tsx
<div className="flex items-center justify-between gap-4 px-4 py-3">
  <div className="flex flex-col">
    <span className="text-ui font-semibold text-foreground">
      Delete all books &amp; data
    </span>
    <span className="text-ui-sm text-muted-foreground">
      Remove every book, cover, and reading position from this device.
    </span>
  </div>
  <Button
    variant="outline"
    size="sm"
    className="shrink-0 text-destructive"
    onClick={() => setResetOpen(true)}
  >
    <TrashIcon weight="light" className="size-4" />
    Delete all
  </Button>
</div>
```

7e. Add a new `<section>` after the Storage `</section>` (last section in the `flex flex-col gap-8` column):

```tsx
<section className="flex flex-col gap-3">
  <SectionHeader
    icon={
      <ArchiveBoxIcon className="size-4 text-muted-foreground" weight="light" />
    }
  >
    Backup &amp; Restore
  </SectionHeader>

  <div className="flex flex-col divide-y divide-border rounded-sm border border-border bg-card">
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex flex-col">
        <span className="text-ui font-semibold text-foreground">
          Save a backup
        </span>
        <span className="text-ui-sm text-muted-foreground">
          Download your books, reading progress, and collections as one file.
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        disabled={exporting}
        onClick={() => void exportNow()}
      >
        {exporting ? (
          <SpinnerIcon weight="light" className="size-4 animate-spin" />
        ) : (
          <DownloadSimpleIcon weight="light" className="size-4" />
        )}
        Export
      </Button>
    </div>

    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex flex-col">
        <span className="text-ui font-semibold text-foreground">
          Restore from a backup
        </span>
        <span className="text-ui-sm text-muted-foreground">
          Add books and progress from a Librune backup file.
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        disabled={importing}
        onClick={() => fileInputRef.current?.click()}
      >
        {importing ? (
          <SpinnerIcon weight="light" className="size-4 animate-spin" />
        ) : (
          <UploadSimpleIcon weight="light" className="size-4" />
        )}
        Import
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importFile(file);
        }}
      />
    </div>
  </div>
</section>
```

7f. Before the closing `</div>` of `<main>`, render the dialogs:

```tsx
{
  conflicts && (
    <BackupConflictDialog
      conflicts={conflicts}
      onApply={(r) => void resolveConflicts(r)}
      onCancel={cancelImport}
    />
  );
}
<ConfirmDeleteDialog
  open={resetOpen}
  onOpenChange={setResetOpen}
  title="Delete all books & data?"
  description="This removes every book, cover, collection, and reading position from this device. Your saved backups are not affected. This can't be undone."
  onConfirm={handleReset}
/>;
```

Note: the Import button's accessible name is "Import"; the test matches `/restore from a backup/i` against the row — change the test to `name: /^import$/i` if role-name matching only sees the button label, or give the button `aria-label="Restore from a backup"`.

- [ ] **Step 8: Run the settings + dialog tests, confirm they pass**

Run: `pnpm test:run src/app/screens/settings/__tests__/settings-screen.test.tsx src/features/library/components/__tests__/backup-conflict-dialog.test.tsx`
Expected: PASS (existing + new).

- [ ] **Step 9: Verify in the browser**

Ask the user to approve starting the dev server, then:

- `preview_start` the dev app, navigate to `/settings`
- `read_page` — confirm the "Backup & Restore" section renders with Export/Import, and Storage has "Delete all books & data"
- Click Export (`computer`), check `read_network_requests`/console for errors and that a download is attempted
- `computer` screenshot for the user

- [ ] **Step 10: Commit**

```bash
git add src/features/library/components/backup-conflict-dialog.tsx src/features/library/components/__tests__/backup-conflict-dialog.test.tsx src/app/screens/settings/settings-screen.tsx src/app/screens/settings/__tests__/settings-screen.test.tsx
git commit -m "$(cat <<'EOF'
feat(backup): Settings — Backup & Restore section + Reset library

Export/Import rows wired to useBackup, a per-book progress-conflict dialog,
and a confirm-gated "Delete all books & data" row in Storage.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 11: STOP** — wait for go-ahead before Task 7.

---

## Task 7: End-to-end recovery test

**Files:**

- Create: `e2e/backup-restore.spec.ts`

**Interfaces:**

- Consumes: the running app (Playwright `webServer` in `playwright.config.ts`), fixture `src/tests/fixtures/valid-book.epub` (title "The Nature of a Crime").

- [ ] **Step 1: Write the e2e test**

Create `e2e/backup-restore.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Sprint 8 Day 6 item 31 — the "export -> clear data -> import" recovery
 * scenario, end to end: import a book and read into it, export a backup,
 * wipe the library, then restore from the backup and confirm the book and
 * its reading position come back.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "../src/tests/fixtures/valid-book.epub");
const BOOK_TITLE = "The Nature of a Crime";

test("backup and restore round-trips a book and its progress", async ({
  page,
}) => {
  // Import
  await page.goto("/library");
  await page.getByRole("button", { name: "Add to library" }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Import Book" }).click(),
  ]);
  await chooser.setFiles(FIXTURE);
  await expect(page.getByRole("heading", { name: BOOK_TITLE })).toBeVisible({
    timeout: 20_000,
  });

  // Read a little way in, then let progress save
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(1500);
  await page.goBack();

  // Export
  await page.goto("/settings");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /export/i }).click(),
  ]);
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  // Wipe
  await page.getByRole("button", { name: /delete all/i }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /delete/i })
    .click();
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: BOOK_TITLE })).toHaveCount(0);

  // Restore
  await page.goto("/settings");
  const [restoreChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /import/i }).click(),
  ]);
  await restoreChooser.setFiles(backupPath!);
  await expect(page.getByText(/Backup restored/i)).toBeVisible({
    timeout: 20_000,
  });

  // Book is back, and reopening lands past chapter 1
  await page.goto("/library");
  await page.getByRole("heading", { name: BOOK_TITLE }).click();
  await expect(page.getByRole("heading", { name: BOOK_TITLE })).toBeVisible({
    timeout: 20_000,
  });
});
```

- [ ] **Step 2: Run it**

Ask the user to approve, then run: `pnpm test:e2e backup-restore`
Expected: PASS on all three projects (mobile/tablet/desktop). If the FAB/import selectors differ from what `cross-device.spec.ts` uses, copy that file's exact selectors and the arc-animation `expect.poll` guard. If the download event doesn't fire in a project, confirm `downloadBlob` runs (jsdom-free real Chromium should honor `<a download>`).

- [ ] **Step 3: Commit**

```bash
git add e2e/backup-restore.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): backup -> reset -> restore recovery round-trip

Sprint 8 Day 6 item 31 — import + read + export, wipe, restore, and verify
the book and its progress come back. Runs on all three device projects.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: STOP** — wait for go-ahead before Task 8.

---

## Task 8: Documentation

**Files:**

- Modify: `docs/tasks/SPRINT-08-TASKS.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Sprint 8 task list**

In `docs/tasks/SPRINT-08-TASKS.md`:

- Change the Day 6 header from `## Day 6 — Final QA` status to reflect item 31 done and others in progress.
- Rewrite item 31 from `❌` to:

  > 31. ✅ **Backup/export workflow validation** — `services/backup/` (ZIP archive: `manifest.json` + `books/<id>.epub` + `covers/<id>`, `createArchive`/`readArchive`). `exportLibrary()` packs every book/file/cover/grouping plus the ten persisted preference keys; `importBackup` merges by `fileHash` — unknown books restored with fresh ids and a background index build, known books skipped unless a chapter-level reading-progress conflict is resolved "use backup" via a per-book dialog. `resetLibrary()` wipes all seven tables + OPFS. Settings → "Backup & Restore" (Export/Import) and Settings → Storage → "Delete all books & data". Covered by unit tests (`backup-archive`, `export-library`, `import-backup`, `reset-library`, `use-backup`, `backup-conflict-dialog`) and `e2e/backup-restore.spec.ts` (the export → clear → import recovery scenario, all three device projects).

- Update the "Open Questions" entry about backup/export scope — replace it with a one-line resolved note: series groupings are re-derived on import (not trusted from the archive); preferences apply only on a fresh device.
- Update the header's "Since the … refresh" bullet and the intro line to note Day 6 item 31 is complete, items 27–30 still open.

Follow the existing file's tone — no "correction"/changelog narration, state it as current fact.

- [ ] **Step 2: Update `CLAUDE.md`**

In `CLAUDE.md`, under `## Architecture` → after the `### Storage (Dexie / IndexedDB)` section, add a short `### Backup & restore` subsection:

```markdown
### Backup & restore

`services/backup/` owns the archive format only — `backup-archive.ts`
(`createArchive`/`readArchive`) reads/writes a ZIP: `manifest.json`
(book rows, groupings, a ten-key preferences snapshot) + `books/<id>.epub`

- `covers/<id>`. No Dexie/Zustand here.

`features/library/actions/` orchestrates: `export-library.ts` gathers
storage + preferences; `import-backup.ts` merges an archive back in, keyed
by `StoredBook.fileHash` — unknown books get a fresh `id` + a background
`buildIndex`, known books are skipped unless a **chapter-level** reading-
progress difference is resolved "use backup" (per-book, via
`BackupConflictDialog`). Series membership is always re-derived through
`ensureSeriesGroupings` rather than trusted from the archive; collections
are recreated by case-insensitive name. Preferences from a backup apply
only on a device with no `librune-preferences` in `localStorage`.
`reset-library.ts` clears all seven tables + OPFS files.

`searchIndex`/`chapterText` are never in an archive — they rebuild on
import. `BACKUP_VERSION` (in `backup-types.ts`) gates import compatibility
and is unrelated to any app version.
```

- [ ] **Step 3: Commit**

```bash
git add docs/tasks/SPRINT-08-TASKS.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(sprint-8): mark Day 6 backup/export complete; document services/backup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Final verification**

Ask the user to approve running the full suite: `pnpm test:run` and `pnpm build`.
Expected: green. Then the branch is ready for a PR (`gh pr create`), which the user initiates.

- [ ] **Step 5: STOP.**

---

## Self-Review

**Spec coverage:**

| Spec section                                                                                                                     | Task                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Decision 1 — ZIP format, manifest shape                                                                                          | Task 1                                                                                                                   |
| Decision 2 — module layout                                                                                                       | Tasks 1–5 (each file mapped)                                                                                             |
| Decision 3 — merge by fileHash, fresh id, chapter-level conflict, groupings, background index, failure isolation, summary counts | Task 4                                                                                                                   |
| Decision 4 — version handling, `BackupFormatError` messages                                                                      | Tasks 1, 4                                                                                                               |
| Decision 5 — preferences only on a fresh device, all 10 keys, via setters                                                        | Tasks 2 (snapshot), 4 (apply)                                                                                            |
| Decision 6 — reset library, confirm-gated, 7 tables + OPFS + stores, `hadBooks` cleared                                          | Tasks 3, 6                                                                                                               |
| Decision 7 — Settings UI: Export/Import rows, conflict dialog, Reset in Storage                                                  | Task 6                                                                                                                   |
| Data flow (export / import / reset)                                                                                              | Tasks 2 / 4 / 3                                                                                                          |
| Error-handling table                                                                                                             | Tasks 1 (format), 2 (missing file on export), 4 (missing entry, collection failure, prefs partial), 3 (OPFS unavailable) |
| Testing — 5 unit suites + e2e                                                                                                    | Tasks 1–6 (unit), 7 (e2e)                                                                                                |
| Out of scope items                                                                                                               | not built (correct)                                                                                                      |
| Sequencing 1–7                                                                                                                   | Tasks 1–8 in order                                                                                                       |

No spec requirement is left without a task.

**Placeholder scan:** none — every step has concrete code or concrete file-edit instructions.

**Type consistency:**

- `BackupData { manifest, files, covers }` — defined Task 1, consumed Tasks 2/4/5 identically.
- `readBackup` returns `{ data, conflicts }` — Task 4 defines, Task 5 destructures `{ data, conflicts: found }`, matches.
- `applyBackup(data, resolutions: Map<string, ConflictResolution>)` — Task 4 signature; Task 5 calls `applyBackup(data, new Map())` and `applyBackup(data, resolutions)`; Task 6 dialog produces `Map<string, ConflictResolution>` keyed by `localId`; consistent.
- `ProgressConflict.localId` is the resolution map key everywhere (Task 4 `resolutions.get(local.id)`, Task 6 `new Map(conflicts.map(c => [c.localId, "keep"]))`, Task 5 test `[["l1", …]]`).
- `ConflictResolution = "keep" | "take-backup"` — same string literals in Task 4 logic, Task 6 dialog, all tests.
- `useBackup()` return shape — Task 5 defines `{ exporting, importing, conflicts, exportNow, importFile, resolveConflicts, cancelImport }`; Task 6 destructures exactly those names.
- Icons `DownloadSimpleIcon` already imported in `settings-screen.tsx` (verified); Task 6 adds `ArchiveBoxIcon`, `UploadSimpleIcon`, `TrashIcon`, `SpinnerIcon`.
- `ConfirmDeleteDialog` props (`open`, `onOpenChange`, `title`, `description`, `onConfirm`) — matches the real component read during planning.

One known soft spot flagged inline for the executor: the exact prop names of the repo's `RadioGroup` wrapper (`value`/`onValueChange` vs Base UI's own) and Playwright selector drift in the e2e test — both have inline fallback instructions in Tasks 6 and 7.
