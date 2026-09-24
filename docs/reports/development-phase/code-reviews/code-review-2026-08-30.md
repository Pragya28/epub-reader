# Code Review — 2026-08-30

A full-codebase correctness review (`/code-review xhigh`) of `src/` (~140 source
files, ~14k LOC), followed by an `/impeccable audit` design pass, the fixes for
both, and a documentation refresh. All work landed on branch
`fix/code-review-findings`.

## Method

The tree was clean with no diff under review, so the review was scoped to the
whole `src/` tree rather than a changeset. Seven subsystem passes ran in
parallel — EPUB parsing, the windowed iframe reader engine, search, storage /
IndexedDB, library actions & grouping logic, reader/preferences/PWA state, and
the React hooks/components layer. Each pass returned candidate findings; every
candidate was then re-verified against the source (line numbers, callers,
trigger conditions) and deduped, a gap sweep was run, and the report was capped
at the 15 most severe.

Refuted during verification (not reported): the cover-cache object-URL "leak"
(the double-check inside `cacheCoverUrl` closes the race), a claimed
`manualStatus` store/DB divergence (`updateBookProgress` clears it in both), and
the Dexie compound-key / version-block index syntax (correct across v3–v6).

## Findings (all 15 fixed)

| #   | Area                                                                      | Defect                                                                                                                                                                                                                                                                                                                          | Fix                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `reader/engine/scroll/detect-visible-chapter.ts`                          | Active chapter picked by nearest top edge (`Math.abs(rect.top)`), so `activeIndex` advanced to N+1 at chapter N's midpoint — saved progress restored to the top of N+1, losing the back half of every chapter on resume; also wrong footer / TOC highlight / aria-live / auto-"finished".                                       | Active chapter is the section covering the viewport top (`rect.top <= 0 && rect.bottom > 0`), with a nearest-upcoming fallback. Test file rewritten to the new contract.              |
| 2   | `epub/parsers/chapter-parser.ts` (+ `toc-parser.ts`, `epub-parser.ts`)    | `resolvePath` returned a percent-encoded pathname; JSZip keys entries by their literal decoded names, so any book with a space or non-ASCII char in a filename lost its chapters, cover, images, fonts and TOC targets.                                                                                                         | `decodeURIComponent` the resolved path in all four spots.                                                                                                                             |
| 3   | `services/search/search-index.ts`                                         | `putIndexEntries` did an append-only `bulkAdd` and `buildIndex` never cleared a prior index; the racy `hasIndex` guard let the normal import→search overlap run a second full build, doubling every row.                                                                                                                        | Atomic replace: delete the book's rows + `bulkAdd` inside one `db.transaction`, which also serializes concurrent builds.                                                              |
| 4   | `services/storage/groupings.ts`                                           | `upsertSeriesMembership` was a non-atomic check-then-create; concurrent callers (notably `ensureSeriesGroupings`' `Promise.all`) each minted a duplicate series grouping.                                                                                                                                                       | Wrap the read-check-create in a 3-table `db.transaction` so callers serialize. `ensureSeriesGroupings` also made sequential + per-book try/catch.                                     |
| 5   | `features/library/actions/delete-book.ts` (+ `confirm-delete-dialog.tsx`) | Four sequential un-transacted deletes then `removeBook` last, no try/catch; a mid-sequence failure left an un-openable ghost card, orphaned index/grouping rows, and a phantom empty series. The confirm dialog swallowed the error.                                                                                            | Reflect the deletion in the store immediately after the storage delete; best-effort the dependent-row cleanup with `Promise.allSettled`; the dialog catches and shows `notify.error`. |
| 6   | `features/library/actions/import-book.ts` (+ `book-repository.ts`)        | Duplicate-import detection scanned the in-memory Zustand snapshot, never IndexedDB — missed across tabs or before the first `loadLibrary`.                                                                                                                                                                                      | New `getBookByFileHash` (indexed query); the check hits storage.                                                                                                                      |
| 7   | `features/library/hooks/use-library-screen.ts` (+ `load-library.ts`)      | `loadLibrary()` on every `visibilitychange` flipped the global `isLoading`, blanking a populated grid and resetting scroll on every return-to-foreground.                                                                                                                                                                       | `loadLibrary({ silent })` skips the loading flag; the visibility re-fetch passes `silent: true`.                                                                                      |
| 8   | `features/library/hooks/use-grouping-books.ts`                            | Never called `loadLibrary`, so series/collection detail screens rendered empty on deep-link/refresh; also showed stale data on a `groupingId` change without unmount.                                                                                                                                                           | Load the library when the store is empty; ignore data loaded for a previous `groupingId` (derived during render, no synchronous setState in effect).                                  |
| 9   | `services/storage/groupings.ts`                                           | `ensureSeriesGroupings` — the documented series backfill — was never invoked from app code; pre-schema books never appeared on the Shelves tab.                                                                                                                                                                                 | Wired into `useShelvesScreen`'s load path.                                                                                                                                            |
| 10  | `features/library/actions/collections.ts`                                 | `addBookToCollection` order = `count()`, which collides after any removal and on concurrent adds — breaking the documented add-order invariant.                                                                                                                                                                                 | `max(order) + 1` computed inside a `db.transaction`.                                                                                                                                  |
| 11  | `features/reader/hooks/use-wake-lock.ts`                                  | `visibilitychange → visible` re-acquired the sentinel but never re-armed the inactivity timer, so the `keepScreenAwakeMinutes` safety cap stopped working after the first hide/show cycle.                                                                                                                                      | Re-arm the timer in the visibility handler.                                                                                                                                           |
| 12  | `services/search/search-metadata.ts`                                      | The whole query was matched as one contiguous substring per field, so `"tolkien hobbit"` (author + title) returned nothing while content search tokenized.                                                                                                                                                                      | Split into terms; every term must appear somewhere in the combined title+author+description.                                                                                          |
| 13  | `features/library/store/search-maintenance-store.ts`                      | `startRebuild` had `try/finally` with no `catch`; a `getAllBooks()` rejection left `status: "running"` and permanently disabled the rebuild button for the session.                                                                                                                                                             | Whole body inside `try`; `catch` resets to idle. Regression test added.                                                                                                               |
| 14  | `epub/parsers/chapter-parser.ts`                                          | The CSS absolute-URL neutralizer (`/^[a-z]+:\/\//i`) missed protocol-relative `url(//host/x)` and root-relative `url(/x)`, which then reached the reader iframe and fired an external request on render — the exact phone-home the code exists to prevent. `<img src="https://…">` in chapter HTML likewise survived DOMPurify. | Broaden the CSS check to `//host` and `/root`; new `isExternalAssetRef` strips external `<img>` / SVG `<image>` refs before sanitization.                                             |
| 15  | `features/preferences/hooks/use-apply-theme.ts` (+ `index.html`)          | Theme class applied in a post-paint `useEffect` with no blocking head script → a wrong-theme flash on every cold load for anyone whose saved theme differs from their OS setting.                                                                                                                                               | Blocking `<head>` script applies the saved theme pre-paint; hook switched to `useLayoutEffect` + a same-value guard.                                                                  |

## Impeccable audit

First pass: **18/20** — 1 P1 (search field with no focus indicator), 1 P2
(`computeScrollAnchor` walking the DOM on every scroll frame for a value only the
1.5 s-debounced save consumes), 3 P3 (off-ramp `text-xs` / `text-sm` in shadcn
primitives, `rounded-lg` / `rounded-md` drift, `RadioGroupRow` focus ring not
distinct from its checked state). The prior audit's bundle-size P2 was already
resolved by Sprint 8 Day 3's route splitting.

All six were fixed:

- Search-field wrapper carries `focus-within:ring-ring/50`; `RadioGroupRow`
  gets a `focus-visible` ring.
- `computeReaderProgress({ includeAnchor: false })` on the scroll path; the
  anchor `DOM` walk runs once, inside the debounced save.
- `text-xs` / `text-sm` → `text-ui-sm` / `text-ui` in `tabs`, `toggle`, `input`,
  `empty`, `search-result-row`.
- `rounded-lg` / `rounded-md` reconciled with the documented `sm / md / xl / 3xl`
  scale and the Object/Control Split.

Rerun: **20/20**. Detector down to 3 verified false positives (`"img src"`
string in the sanitizer allowlist; `18px` ×2 in a test fixture).

## Also folded in from the review (beyond the capped 15)

- Reader `--search-highlight-text` synced to `index.css`'s darkened `--selected`
  (it had drifted to the pre-fix value that measured < 4.5:1).
- `ensureIndexesForBooks` guards the whole per-book callback, not just
  `buildIndex`, so one Dexie error can't reject the backfill.
- `buildIndex` revokes each chapter's image blob URLs (indexing reads only the
  stripped text) instead of leaking one per picture for the whole book.
- `findCover`'s filename fallback restricted to image extensions.
- `CSS.escape` on the interpolated ids in the OPF collection `querySelector`s.
- `beforeinstallprompt` captured at module scope so the Settings "Install" row
  sees it, not only the library banner.
- The NEW badge derives from "untouched", not `status === "unread"` (import
  seeds a `progress` object, so nothing was ever eligible).

## Deferred items — now implemented

Both were resolved after the audit:

- **`book-repository.ts` re-exports** `saveBookFile` / `getBookFile` from
  `book-files` — removed; `rebuild-search-index.ts` and `search-service.ts`
  import from `book-files` directly, and ~7 test files updated to spy/mock the
  defining module. (CLAUDE.md: "Don't re-export one module's functions through
  another for convenience.")
- **`book-repository.deleteBook`** ran three deletes in a bare `Promise.all` — a
  mid-delete failure could orphan a cover or file blob. Now: file delete first
  and outside the transaction (it may be OPFS), then the cover and `books` row
  atomically in a `db.transaction`, so a failure can't split them and the delete
  is safely retryable.

## Not addressed (lower-confidence / larger-scope, from the raw agent output)

Recorded here so they aren't lost:

- `db.ts` — `&fileHash` was retro-fitted into the shipped `version(2)` block
  rather than a new version; a DB already at v2 never materializes the unique
  index. Latent (affects only a hypothetical early-adopter install).
- `parseChapterDocument` — a valid XHTML chapter with no `xmlns` yields a null
  `body` and renders blank with no error.
- `use-series-detail-screen` — the `hideFinished: false` override only applies
  while no other filter is active; touching an unrelated filter silently hides
  finished books and flips the switch.
- `searchLibrary` re-runs the `ensureIndexesForBooks` sweep (N `hasIndex`
  round-trips) on every debounced keystroke even when fully indexed.
- `listGroupings` does `toArray()` + JS filter despite the `type` index.
- cover-cache module Map has no eviction — every cover ever loaded stays alive
  for the tab's lifetime.
- `snippet.ts` — substring (not token) match, and HTML entities aren't decoded
  (`&amp;` shown literally; `amp` / `lt` junk tokens indexed).
- Dead code: `parseAllChapters`, `getChapterSnippet`, the fully-wired-but-unused
  swipe-navigation in `use-reader-engine`, `ParsedChapter.stylesheets`
  (computed every `loadChapter`, never read), `src/tests/dev/test-opf-parser.ts`.
- `pickFiles` never resolves and leaks a detached `<input>` when the OS file
  dialog is cancelled.
- Several library hooks subscribe to the whole Zustand store with no selector.

## Verification

- `pnpm build` + full `pnpm test:run` (pre-push hook): **75 files, 667 tests,
  all passing**; largest chunk 230 kB gzip (budget 310 kB).
- `pnpm exec vitest related` (pre-commit hook) on every touched file: passing.
- `node .../impeccable/scripts/detect.mjs`: 3 findings, all verified false
  positives.

## Documentation

- `AUDIT_REPORT.md` moved to `docs/AUDIT_REPORT.md`; `CLAUDE.md` and the
  `sprint-workflow` skill updated to the new path.
- `DESIGN.md` frontmatter: added the three user-selectable reader fonts (Lora /
  DM Sans / Atkinson Hyperlegible) to `typography:` so the detector stops
  flagging them; corrected `rounded.3xl` to the real token value (`0.825rem` =
  `--radius * 2.2`, was documented as `1.05rem`).
- `.impeccable/design.json` regenerated — its narrative still described the
  retired "sharp rectangular controls / `rounded-none` buttons" world; it now
  matches the graduated soft-radius Object/Control Split, and adds the
  `selected` / `warm-accent` / `control-edge` colors, the reader fonts, the
  search-field and radio-row components, and the reduced-motion token.

## Commits (branch `fix/code-review-findings`)

| SHA           | Summary                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| `f5e0250`     | fix: apply 15 code-review findings                                          |
| `5ea55ca`     | docs(impeccable): audit report — 18/20                                      |
| `ebd742e`     | fix: apply audit findings + remaining code-review items                     |
| `85a9cea`     | docs(impeccable): audit rerun 20/20; refresh DESIGN.md + sidecar            |
| _(this pass)_ | move AUDIT_REPORT into docs/; implement the two deferred items; this report |

## Tooling note

`npx impeccable update` (offered to move v4.0.4 → v4.1.1) does not apply here —
impeccable is installed as a Claude Code plugin, not via `npx impeccable
install`. Updating goes through the plugin manager (`/plugin`), not `npx`.
