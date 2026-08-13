# Collection Management — Figma Design Review

Reviewed 2026-08-13 against `tasks/stitch-collection-management-prompt.md`'s 8 requirements and Sprint 7 Day 3/5's spec (create/rename/delete collections, add/remove books, empty states).

Figma: [Collection Management](https://www.figma.com/design/ohsm1arYYCfzARM2RuNBI5/Librune?node-id=103-535), node `103:535`.

## Coverage

| #   | Requirement                                             | Status                                                                                                                                                                          |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | View all collections (grid, count, cover stack preview) | ✅ Library entry-point row + full Collections grid, linked via "View All Collections." Stacked-cover previews correctly differentiate multi-book/single-book/empty collections. |
| 2   | Create a collection                                     | ✅ "New Collection" dialog, single name field, one `+ Create` button.                                                                                                           |
| 3   | Rename a collection                                     | **Resolved — reuses the Create sheet, pre-filled with the existing name.** No separate rename screen needed.                                                                    |
| 4   | Delete a collection                                     | ✅ Strong — explicit reassurance copy: _"This will delete the '{name}' grouping. Your books will remain safe in your library."_                                                 |
| 5   | Add books to a collection                               | ✅ Checklist sheet, multi-select checkboxes, inline `+ New Collection` row, `Done` to confirm.                                                                                  |
| 6   | Remove a book from a collection                         | **Resolved — reuses the same per-book menu already used elsewhere in the library** (not a new affordance). No new design needed here.                                           |
| 7   | Empty states (no collections / empty collection)        | ✅ Both present, well-differentiated: "No collections yet" (library-level) vs. "This shelf is empty" (single-collection-level).                                                 |
| 8   | Collection detail view                                  | ✅ Header + name + `⋮` menu + book count, reuses the existing book-grid card.                                                                                                   |

## Design-system deviations — keep the actual system, not what the comp drew

The comp introduced two accent-color departures from `.agents/context/DESIGN.md`. Decision: **keep the actual design system as documented**, i.e. these are bugs in the comp to correct during implementation, not intentional scope changes:

1. **Gold (`warm-accent`) reused for collection actions** (`+ Create Collection` empty-state button, `+` FAB on the Collections grid). `DESIGN.md` reserves gold exclusively for reading-focused CTAs (continue-reading banner, import FAB). These should use the ink-black primary button style instead — same as the New Collection dialog's `+ Create` button, which already does this correctly.
2. **Selected-checkbox color** on the Add-to-Collection checklist reads as dark/navy rather than the amber `--selected` token, the app's one "this is the active choice" signal. Correct to `--selected` during implementation.

Delete-button styling (near-black rather than `destructive-clay`) was flagged but not resolved either way — reassurance copy carries most of the safety burden here; leaving as a call for implementation/QA rather than a hard requirement.

## Net effect on Sprint 7 tasks

`tasks/SPRINT-07-TASKS.md` Day 3 (Collections CRUD) and Day 5 (UX Polish, empty states, delete-flow distinction) items are all covered by this design — no new screens needed. Implementation should:

- Build one "Collection name" sheet component that serves both create and rename (title/button copy differ, field pre-fills for rename).
- Extend the existing per-book library menu with a "Remove from collection" action, conditional on collection-detail context, rather than building a new affordance.
- Use `--primary`/ink-black (not `warm-accent`) for collection create/add actions; use `--selected` (not a custom blue) for the add-to-collection checklist's checked state.
