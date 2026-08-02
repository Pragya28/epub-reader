# Sprint 4 — Task List (Gap Analysis vs Codebase)

Generated 2026-08-02 by comparing `docs/06 - Implementation/Sprint - 04 Library System.md` against the current codebase.

Legend: ✅ done · 🟡 partial · ❌ missing

---

# Already Complete (credit from prior sprints)

- **Basic library** — grid view, book cards, cover rendering (`src/features/library/components/`)
- **Metadata storage** — `title`, `author`, `language`, `createdAt`, `fileHash`, `coverBg` in `StoredBook` (`src/services/storage/storage-types.ts`)
- **Reading progress integration** — `progress`/`manualStatus` embedded on `StoredBook`, derived into `ReadingStatus` via `derive-book-status.ts`, surfaced on cards (`isNew`/`isFinished`/`isReading`, `continue-reading-banner.tsx`)
- **Storage plumbing** — Dexie (`db.ts`, schema v3), `book-repository.ts` / `cover-cache.ts` wrap raw calls; three tables: `books`, `bookFiles` (Blob), `bookCovers` (Blob)
- **Manual status actions** — `mark-book-status.ts` (finished/unread/restart)

Everything below Sprint 4 actually asks for is **missing** — this sprint hasn't started yet.

---

## Day 1 — Storage Layer

1. ❌ **OPFS storage for EPUB files** — `bookFiles` table stores the raw EPUB `Blob` directly in IndexedDB (`src/services/storage/db.ts`); no `services/storage/opfs` module, no `navigator.storage.getDirectory()` usage anywhere in `src/`.
2. ❌ **Storage abstraction layer** — no interface separating "where the EPUB bytes live" from `book-repository.ts`; repository calls Dexie directly.
3. ❌ **Migration from existing storage** — no migration path for books already sitting in IndexedDB `bookFiles` moving to OPFS.

## Day 2 — Metadata Enrichment

4. ❌ **Chapter count** — not extracted or stored on `StoredBook`; chapters are parsed lazily per-`loadChapter()` call ([epub-parser.ts](src/services/epub/epub-parser.ts)) and total count is only known transiently inside the reader (`totalChapters` on `ReadingProgress`, not on the book record itself).
5. ❌ **Word count** — no field, no calculation.
6. ❌ **Estimated reading time** — no field, no calculation.
7. ❌ **Book description** — `opf-parser.ts` parses `dc:title`/`dc:creator`/`dc:language`; `dc:description` is not extracted or stored.
8. ❌ **Extended `StoredBook` schema** — needs a `db.version(4).stores(...)` bump per the CLAUDE.md-documented pattern to add these fields without breaking existing records.

## Day 3 — Library Search

9. ❌ **Metadata search (title/author/description)** — no search input or filtering logic anywhere in `src/features/library/`. Also closes the `AUDIT_REPORT.md` [P1] "dead Search button" finding — the header button has no `onClick` because this feature doesn't exist yet; wire it up as part of building this, don't stub it separately.
10. ❌ **Search performance work** — moot until search exists; watch for a naive `Array.filter` over the full library being fine at expected scale (don't add an index prematurely).

## Day 4 — Sorting & Filtering

11. ❌ **Sorting** (title, author, imported date, last opened, progress, status) — `library-store.ts` holds `books: StoredBook[]` with no derived/sorted view; `load-library.ts` returns repository order as-is.
12. ❌ **Filtering** (reading status, language, author) — no filter state or UI control exists. Also closes the `AUDIT_REPORT.md` [P1] "dead Filter button" finding, same reasoning as #9.
13. ❌ **Combined search + sort + filter** — depends on #9, #11, #12.

## Day 5 — Book Management

14. ❌ **Centralized delete service** — no `delete-book.ts` action; nothing calls `bookFiles`/`bookCovers`/`books` deletes together.
15. ❌ **Delete EPUB / metadata / cover / progress** — `progress` and `manualStatus` live embedded on the `books` row (no separate table), so "delete progress" is a partial update, not a row delete — worth confirming the delete service handles that correctly rather than only clearing `bookFiles`/`bookCovers`.
16. ❌ **Delete search index** — N/A until #9 exists; if search stays an in-memory filter (recommended per #10), there's no persisted index to clean up.
17. ❌ **Destructive-action confirmation UI** — `book-card.tsx` has a dropdown menu (mark finished/unread/restart) but no delete entry or confirm dialog.

## Day 6 — Library UI Polish

18. ❌ **Book card sizing/spacing refinement** — current cards are functional (`book-card.tsx`, `aspect-2/3` cover); no polish pass done against this sprint's goals.
19. ❌ **Mobile visual density** — not addressed.
20. ❌ **Empty library state** — no dedicated empty-state component found under `src/features/library/components/`.
21. ❌ **Loading states** — `library-store.ts` has `isLoading`, but no evidence of a skeleton/spinner component consuming it in the grid.
22. ❌ **Error states** — `library-store.ts` has `error`, same gap as above.
23. ❌ **Library animations** — none present.
24. ❌ **`aria-live`/`role="status"` on loading & error states** — folded in from `AUDIT_REPORT.md` [P2]; build this as part of #21/#22 rather than as a separate pass, since it's the same components.
25. ❌ **Lazy-load real book cover images** — folded in from `AUDIT_REPORT.md` [P2]; `book-cover.tsx:16-20` renders covers as CSS `background-image` with no `loading="lazy"`. Natural to do alongside #18 (card sizing/spacing pass).
26. ❌ **Library title as a semantic heading** — folded in from `AUDIT_REPORT.md` [P3]; `library-screen.tsx:75` "Your Personal Collection" is a `<div>`, should be `<h1>`/`<h2>`. One-line fix, same screen as the rest of this day.

## Day 7 — Integration & Hardening

24. ❌ **Full library regression pass** — blocked on Days 1–6.
25. ❌ **Large-library performance testing** — no fixture/benchmark analogous to the reader's `large-book.epub` perf test for a large _library_ (many books).
26. ❌ **Import → Read → Delete workflow test** — `import-book.test.ts` and `load-library.test.ts` exist; no end-to-end workflow test, and delete doesn't exist yet to test.

---

# Deferred (not this sprint)

From `AUDIT_REPORT.md`, two findings are better handled outside Sprint 4:

- **[P1] No `prefers-reduced-motion` support** — project-wide (`button.tsx`, `import-book-fab.tsx`, shared skeletons), not library-specific. Fixing it as a drive-by here means re-touching it again when the reader/settings screens get the same treatment; better as one dedicated accessibility pass across the whole app.
- **[P2] Font sizes drifted off the DESIGN.md type ramp** — a design-system/theming documentation issue. The Sprint 4 doc itself names Sprint 5 as "where user customization through theming and typography becomes the primary focus" — natural fit there instead.

---

# Suggested Sequencing

Day 1 (OPFS) and Day 2 (metadata schema bump) both touch `StoredBook`/`db.ts` — do them together in one schema version bump rather than two, per the existing "no migration needed, Dexie reindexes on next write" pattern already documented in CLAUDE.md. Days 3–4 (search/sort/filter) are pure `library-store` + derived-selector work and can follow independently. Day 5 (delete) should land after Day 1, since the delete service needs to know whether it's clearing a Dexie blob or an OPFS file. Day 6 (UI polish) is decoupled and can run in parallel with any of the above. Day 7 is integration once the rest lands.
