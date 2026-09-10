# Sprint 8 Day 6 — Library Backup & Restore Design

## Context

Sprint 8 (`central-docs/06 - Implementation/Sprint - 08 Production Polish.md`)
Day 6 is Final QA, and its Related Gap
([[Library-02 Backup and Export]]) is the last practical point to ship a
backup/restore mechanism before release. Sprint 7 explicitly deferred it
("every field is a plain string/number… so a future export can serialize
the schema directly"), so there is no schema work — only the export/import
mechanism and its UI.

`docs/tasks/SPRINT-08-TASKS.md` items 30–31 (release checklist, backup/export
workflow validation) depend on this landing first.

### What exists

- Storage is Dexie/IndexedDB, schema v6, seven tables. Canonical data:
  `books` (metadata + embedded `progress`/`manualStatus`), `bookFiles`
  (raw EPUB `Blob`, OPFS-primary with an IndexedDB fallback — see
  `book-files.ts`), `bookCovers` (cover `Blob`), `groupings` /
  `groupingMembers` (series + collections).
- Derived, rebuildable data: `searchIndex`, `chapterText`. Already have a
  full rebuild path (`rebuildSearchIndex()` / `buildIndex()`).
- Series groupings re-derive from `StoredBook.seriesName`/`seriesIndex`
  via `ensureSeriesGroupings()`.
- Duplicate detection by content hash already exists
  (`getBookByFileHash`, `&fileHash` unique index; `hashFile` in
  `utils/hash.ts`).
- JSZip is a dependency (`services/epub/epub.service.ts` unzips EPUBs
  with it).
- No "clear all data" / "reset" feature exists anywhere in `src/`.
- Settings screen (`src/app/screens/settings/settings-screen.tsx`) is a
  grouped-row layout with an existing "Storage" section; the error-log
  Diagnostics row there is the closest prior art for "produce a file the
  user saves".

## Decisions

### 1. Archive format: a ZIP (JSZip)

```
librune-backup-<ISO8601>.zip
├── manifest.json
├── books/<bookId>.epub
└── covers/<bookId>            (bytes verbatim; no extension — MIME is in the manifest)
```

`manifest.json`:

```ts
interface BackupManifest {
  version: 1; // BACKUP_VERSION — the backup *format* version, the only thing import compatibility keys on
  exportedAt: number; // Date.now()
  books: StoredBook[]; // full rows, progress + manualStatus included
  groupings: Grouping[]; // series AND collections
  groupingMembers: GroupingMember[];
  preferences: PreferencesSnapshot; // see decision 5
  covers: Record<string, { type: string }>; // bookId -> cover MIME, entry present iff a cover blob is in covers/
}
```

Rejected — **single JSON with base64 blobs**: matches the error-log export
pattern, but that pattern moves kilobytes; a library is tens of MB of
binary. Base64 is ~33% overhead and import becomes `JSON.parse` on one
multi-MB string held entirely in memory. ZIP handles binary natively, the
archive stays inspectable, and a partially-corrupt archive can still
restore its intact `books/*.epub` entries.

`searchIndex` and `chapterText` are **not** in the archive — they rebuild
on import (decision 4). Series `groupings`/`groupingMembers` ARE included
(cheaper than re-deriving, and keeps the manifest a complete snapshot),
but import treats them as advisory — see decision 4.

### 2. Module layout

Framework-agnostic archive I/O in `services/`, orchestration in
`features/library/actions/`, matching the existing split.

| File                                             | Responsibility                                                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/services/backup/backup-types.ts`            | `BackupManifest`, `BackupData`, `PreferencesSnapshot`, `BACKUP_VERSION`                                                                                                              |
| `src/services/backup/backup-archive.ts`          | `createArchive(data: BackupData): Promise<Blob>` · `readArchive(file: Blob): Promise<BackupData>`. Zip read/write + manifest parse/validate only. No Dexie, no Zustand, no `notify`. |
| `src/features/library/actions/export-library.ts` | `exportLibrary(): Promise<Blob>` — read every book/file/cover/grouping from storage, snapshot preferences, call `createArchive`                                                      |
| `src/features/library/actions/import-backup.ts`  | `readBackup(file)` + `applyBackup(data, resolutions)` — merge (decision 3)                                                                                                           |
| `src/features/library/actions/reset-library.ts`  | `resetLibrary(): Promise<void>` — wipe all seven tables + OPFS files + revoke cover URLs                                                                                             |
| `src/features/library/hooks/use-backup.ts`       | download trigger, `<input type=file>` picker, conflict-dialog state machine, `notify` wiring                                                                                         |

`BackupData` is the in-memory shape (`manifest` fields minus the raw-blob
plumbing, plus `files: Map<bookId, Blob>` and `covers: Map<bookId, Blob>`).
`createArchive`/`readArchive` are the only code that knows the zip layout.

No DB version bump — no new table, no new field.

### 3. Import is a merge, keyed by `fileHash`

`applyBackup` walks `manifest.books`. For each incoming book, look up the
local book with the same `fileHash`:

- **No local match** → full restore: write the EPUB blob
  (`bookFiles.saveBookFile`), `db.books.put` the row **with a freshly
  generated `id`** (`createId()` — never trust the archive's id, it may
  collide with an unrelated local row), `db.bookCovers.put` the cover if
  present. Remember `archiveId → newLocalId` for the grouping pass.
- **Local match, `progress.chapterIndex` equal** (treat both-missing as
  equal) → skip entirely. Not a conflict.
- **Local match, `progress.chapterIndex` differs** → record a
  `ProgressConflict { localId, title, localChapter, backupChapter,
localTotal, backupTotal }`. Do not touch storage yet.

Comparison is **chapter-level only** — `scrollFraction`, `anchorPath`,
`wordOffset`, `percent` are never compared and never the reason for a
prompt. When the user chooses to take the backup's progress, the whole
`ReadingProgress` object from the archive is written via
`updateBookProgress` (so scroll position rides along with the chapter
choice); `manualStatus` from the archive is applied in the same write.

`applyBackup(data, resolutions)` takes `resolutions: Map<localId,
"keep" | "take-backup">` — one entry per conflict. The hook collects these
from the dialog before calling `applyBackup`; `readBackup` +
conflict-detection is a separate earlier step so the UI can show the
dialog first. No conflicts → `applyBackup` is called with an empty map and
never blocks.

**Groupings.** After the book pass, for each `manifest.groupings` row of
`type: "collection"`: find or create a local collection by
case-insensitive name (reuse `collections.ts` / `requireCollection`
semantics), then add membership for every member book that now exists
locally (mapped through `archiveId → localId`, falling back to a
`fileHash` match for books that were skipped). `type: "series"` groupings
in the archive are **ignored** — `ensureSeriesGroupings()` is called once
at the end over all touched book ids and re-derives series from the
restored `seriesName`/`seriesIndex`, which is the one code path that owns
series membership.

**Search index.** Every newly-restored book fires a background
`buildIndex(localId, file)` — fire-and-forget with a `.catch` that logs,
exactly the shape `importBook` already uses. Import resolves without
waiting. A book whose index build fails is still fully imported and
`ensureIndexesForBooks()` retries it on the next search.

**Failure isolation.** One unreadable archive entry (missing blob,
corrupt epub) is logged and skipped, never thrown — same discipline as
`rebuildSearchIndex`. `applyBackup` returns
`{ restored: number, skipped: number, conflictsResolved: number,
failed: number }` for the toast.

### 4. Version handling

`readArchive` rejects with a clear error when `manifest.version >
BACKUP_VERSION` ("This backup was made by a newer version of Librune —
update the app and try again."). Equal or lower versions load; the format
stays forward-compatible by only ever adding optional manifest fields.
A missing/unparseable `manifest.json`, or a zip that won't open, rejects
with "This file isn't a Librune backup."

The manifest carries **no app version** — the app has no runtime version
string today (`package.json` isn't exposed to the client; that's Day 7
item 34). `BACKUP_VERSION` is a standalone integer owned by
`backup-types.ts`, not derived from the app version. If Day 7 later wires
up an app version, it can be added to the manifest as an optional
informational field without a `BACKUP_VERSION` bump.

### 5. Preferences: applied only on a fresh device

```ts
interface PreferencesSnapshot {
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
```

All ten persisted `preferencesStore` keys (the `librune-preferences`
`persist` blob), snapshotted whole on export — no transient fields
(`set*` actions, derived selectors).

The `persist` middleware always writes every key (defaults included), so
"which keys did the user deliberately change" is not recoverable from the
stored blob. Rather than guess by comparing against defaults, import uses
a coarser, predictable rule: **apply the snapshot only when
`localStorage['librune-preferences']` is entirely absent** — a genuinely
fresh device that has never run the app. If the key exists at all, the
user has used this device and their preferences are kept untouched, in
full. This satisfies "on conflict, keep current" without a fragile
default-comparison heuristic. Applied via `preferencesStore.setState(snapshot)`
before the store's first render is not possible from an async import, so
the apply calls each individual setter (`setTheme`, `setFontScale`, …) so
the store's own clamping runs. Best-effort: logged, never toasted.

### 6. Reset library

New confirm-gated row in Settings → Storage, below Diagnostics:
**"Delete all books & data"**, destructive styling. Opens a dialog that
requires an explicit confirm action (a distinct "Delete everything"
button, not just "OK" — no type-to-confirm, which is heavier than this
local-only app warrants). On confirm, `resetLibrary()`:

1. Revoke every cached cover object URL (`cover-cache`).
2. `db.transaction("rw", …allTables, …)` → `clear()` each of the seven
   tables.
3. Delete all OPFS book files (enumerate the OPFS dir; fall through
   silently where OPFS is unavailable).
4. Reset the in-memory `libraryStore` (books list → empty) and the
   `search-maintenance-store`.

Preferences and the persisted PWA/install state are **not** cleared —
this resets the _library_, not the app. `hadBooks` (the eviction-detection
flag in `load-library.ts`) is cleared so the post-reset library shows the
first-run empty state, not the "your books were cleared" state.

### 7. Settings UI

New section between "Storage" and nothing (last section), header
"Backup & Restore", `ArchiveBox` icon:

- **Export** row — "Save a backup" / "Download all your books, reading
  progress, and collections as one file." Button: "Export". Disabled with
  a spinner while zipping. On success the browser download starts
  (`URL.createObjectURL` + a synthesized `<a download>` click + revoke);
  toast "Backup saved".
- **Import** row — "Restore from a backup" / "Add books and progress from
  a Librune backup file." Button opens a hidden `<input type="file"
accept=".zip">`. After pick: `readBackup` → if conflicts, the conflict
  dialog; then `applyBackup` → toast with the `{restored, skipped,
conflictsResolved}` summary.
- The **conflict dialog** (Base UI `Dialog`, same primitive as the
  external-link and reader dialogs) lists each conflicting book:
  _"{title} — this device: Chapter {n} of {m} · backup: Chapter {n} of
  {m}"_ with a per-row two-way choice (`RadioGroupRow` from
  `radio-group.tsx`), defaulting to **Keep this device's**. Footer:
  "Cancel" / "Apply". Cancel aborts the whole import (nothing was written
  yet).

"Reset library" lives in the **Storage** section (decision 6), not here —
it's a storage operation, and grouping it with Import risks a mis-click.

## Data flow

```
Export:  settings → use-backup.export()
           → exportLibrary()  [getAllBooks, getBookFile ×N, getBookCover ×N,
                               listGroupings, getMembersForGrouping ×N,
                               preferencesStore.getState()]
           → createArchive(BackupData) → Blob
           → object URL → <a download> click → revoke → toast

Import:  settings → file picker → use-backup.import(file)
           → readBackup(file) = readArchive(file) → BackupData
           → detectConflicts(BackupData)  [getBookByFileHash ×N]
           → [conflicts?] conflict dialog → Map<localId, choice>
           → applyBackup(BackupData, resolutions)
               per book: saveBookFile | db.books.put | db.bookCovers.put | updateBookProgress
               collections: requireCollection find-or-create + addMember
               ensureSeriesGroupings(touchedIds)
               background: buildIndex(localId, file) per restored book
               applyPreferences(snapshot)  [only if no librune-preferences in localStorage]
           → libraryStore.reload() → toast summary

Reset:   settings → confirm dialog → resetLibrary()
           → revoke cover URLs → db.transaction clear() ×7
           → delete OPFS files → reset stores → toast
```

## Error handling

| Failure                                           | Behavior                                                                                                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zip won't open / no manifest                      | reject: "This file isn't a Librune backup." — nothing written                                                                                                                |
| `manifest.version` too new                        | reject: "This backup was made by a newer version of Librune…"                                                                                                                |
| One `books/<id>.epub` entry missing or unreadable | log, `failed++`, skip that book, continue                                                                                                                                    |
| One book's `buildIndex` throws                    | logged in the `.catch`; book stays imported; next search retries                                                                                                             |
| Collection re-create throws                       | log, skip that collection's membership, continue (books already restored)                                                                                                    |
| `applyPreferences` partial                        | log only; never toasted                                                                                                                                                      |
| Export: one `getBookFile` returns undefined       | that book is written to the manifest but has no `books/` entry; `readArchive` on the other end treats it as a missing-blob skip                                              |
| Reset: OPFS enumeration unavailable               | fall through; IndexedDB `clear()` still ran                                                                                                                                  |
| Quota exceeded mid-import                         | the failing book counts as `failed`; already-restored books persist (`importBook`'s persist-then-index ordering already covers per-book atomicity); toast surfaces the count |

## Testing

Colocated `__tests__/`, Vitest + `fake-indexeddb`, reusing
`src/tests/fixtures/*.epub` and `src/tests/utils/`.

- **`backup-archive.test.ts`** — `createArchive` → `readArchive`
  round-trips: manifest fields deep-equal, `files`/`covers` blobs
  byte-equal (compare `await blob.arrayBuffer()`). Rejects a non-zip, a
  zip with no manifest, and `version: 999`.
- **`export-library.test.ts`** — import two fixtures + make a collection +
  set progress, `exportLibrary()`, assert the archive has both
  `books/*.epub` entries, the cover entries, the collection in
  `groupings`, and a `preferences` block.
- **`import-backup.test.ts`** —
  - restore onto an empty DB → both books present, collection recreated,
    `buildIndex` invoked per book (spy), ids are freshly generated not the
    archive's;
  - restore onto a DB already holding one of the two books at the same
    chapter → that book skipped, no conflict, other book restored;
  - restore where the shared book is at a different chapter →
    `detectConflicts` returns one entry with the right
    local/backup chapter numbers; `applyBackup` with `"take-backup"`
    writes the archive's `ReadingProgress`; with `"keep"` leaves it;
  - preferences: `librune-preferences` present in `localStorage` → store
    unchanged after import even though the archive's snapshot differs;
    key absent → every snapshot value applied through the store's setters;
  - a manifest book with no matching `books/` entry → `failed: 1`, others
    unaffected.
- **`reset-library.test.ts`** — populate all seven tables, `resetLibrary()`,
  assert every table `.count()` is 0 and `libraryStore` books is empty;
  `hadBooks` flag cleared.
- **e2e `e2e/backup-restore.spec.ts`** (Playwright, all three projects) —
  import a fixture → open it, read to chapter 3 → Settings → Export
  (capture the download) → Reset library, confirm → Import the captured
  file → library shows the book, reopening it lands on chapter 3. This is
  Sprint 8 Day 6 item 31's "export → clear data → import" recovery
  scenario.

## Out of scope

- **Cloud / automatic backup** — local-first; the file is the user's to
  keep. No scheduling, no remote target.
- **Selective export** ("just this collection") — whole library only.
- **Cross-format import** (Calibre, other readers) — Librune archives
  only. `isEpub()` single-file import already covers "add one book".
- **Merge conflict resolution beyond reading progress** — title/author/
  cover differences on a `fileHash` match don't happen (same hash = same
  file); if they somehow do, the local row wins silently.
- **Encrypting the archive** — it contains only the user's own EPUBs and
  reading metadata, written to a location they chose.

## Sequencing

1. `backup-types.ts` + `backup-archive.ts` + its round-trip test (no app
   deps — pure, testable first).
2. `export-library.ts` + test.
3. `reset-library.ts` + test (independent of import; unblocks the e2e
   wipe step).
4. `import-backup.ts` (`readBackup`, `detectConflicts`, `applyBackup`,
   `applyPreferences`) + test.
5. `use-backup.ts` + Settings UI (Export, Import, conflict dialog) +
   Reset row + `settings-screen.test.tsx` coverage.
6. `e2e/backup-restore.spec.ts`.
7. Update `docs/tasks/SPRINT-08-TASKS.md` (item 31 → ✅, Day 6 progress),
   `CLAUDE.md` architecture section (new `services/backup/`).
