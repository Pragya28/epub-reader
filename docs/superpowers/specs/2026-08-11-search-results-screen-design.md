# Search Results Screen — Design

Status: approved for planning
Date: 2026-08-11
Scope: Sprint 6 Day 4 UI (the results screen Day 4's reader-integration items jump from)

## Background

Sprint 6 Days 1–3 built the search engine (`services/search/`) and `searchLibrary()`
(`src/features/library/actions/search-library.ts`), but nothing renders it. This spec
covers the new results screen only — Day 4's actual reader-integration items (jump to
chapter, highlight match, return-to-reading nav) build on top of it and are scoped
separately in `docs/tasks/SPRINT-06-TASKS.md`.

The design went through two rounds of Figma/Stitch mocks, both revised down to what the
search engine actually returns — no fabricated match counts, page numbers, or multi-word
highlights — then hand-adjusted against the app's existing token system and shadcn
components. This doc captures the final agreed layout.

## Data contract (no service changes needed)

`searchLibrary(books, query)` already returns:

```ts
interface LibrarySearchResults {
  metadataMatches: BookWithProgress[]; // title/author/description hits
  contentMatches: ChapterMatch[]; // { bookId, chapter, matchedWords }
}
```

The results screen renders both lists as one flat sequence of rows — metadata matches
first (as-returned order), then content matches (already ranked by distinct-word-match
count, then chapter index — no new sorting logic needed). No segmented
Relevance/Book/Chapter control: it was in both mock rounds but was cut once we confirmed
it wasn't different data, only three orderings of the same list, and the effort wasn't
justified this sprint. Can be revisited if grouping/sorting turns out to matter in
practice.

Snippet text per content-match row comes from `getChapterSnippet(file, chapter,
matchedWords[0])` — the search engine only supports single-word snippet extraction
today, so the first matched word is what gets highlighted, not the full query phrase.

## Route & navigation

- New `ROUTES.SEARCH` (`/search`) added to `src/utils/routes.ts` alongside
  `LIBRARY`/`READER`/`SETTINGS`.
- `src/app/screens/search-screen.tsx` (routing shell) + a
  `src/features/library/components/search-results-screen.tsx` (or similar; final name at
  implementation time) doing the actual work, matching the existing screen/feature split.
- The library header's search icon button navigates to `/search` instead of toggling the
  existing inline `searchOpen` field. That inline toggle and its `<input>` in
  `library-screen.tsx` / `use-library-screen.ts` are removed — this screen replaces it,
  not sits alongside it.
- No bottom tab bar / persistent nav — the app doesn't have one today and this isn't the
  place to add it. Back arrow returns to the library.

## Layout

Single column, mobile-width layout (this app has no desktop-specific breakpoint need
beyond what the library screen already handles):

1. **Header row** — back arrow + search input merged into one row (no separate "Search"
   title bar above it). Input is icon-prefixed (search glyph), autofocused on mount, with
   a clear (×) button, styled like the app's existing `input-folio` pattern but on the
   app's card/surface token rather than plain background. Results update live as the
   query changes (no explicit submit).
2. **Result count line** — `"{n} results found"` where `n = metadataMatches.length +
contentMatches.length`. Replaces an earlier segmented-control mock; it's simpler and,
   unlike the original Figma draft's fabricated count, backed by real data. No "in N
   books" clause — dropped per feedback, just the flat count.
3. **Result rows** — one unified row shape for both match types, divided by a 1px
   `divider` token line between rows:
   - Cover thumbnail, left, `aspect-2/3` (matching `about-book-sheet.tsx`'s existing
     pattern — not the mocks' square/portrait-ish approximations).
   - Right column, top-aligned with the cover, single stack, no separate indent or nested
     border for the snippet portion:
     - Book title (semibold)
     - Author (small caps/uppercase, muted)
     - _(content matches only, continuing in the same column)_ chapter title (muted,
       smaller), then the italic snippet with the matched word highlighted via a
       `mark`-equivalent using the app's warm accent tokens at reduced opacity.
   - A metadata-only match (book title/author hit, no chapter match) is just
     cover/title/author — row ends there.
4. No section headings ("Books" / "In this book") — removed per feedback; the row shape
   itself (present vs. absent chapter/snippet lines) is self-explanatory.

## Visual tokens

Reuses the app's existing warm/parchment tokens exclusively — no new colors introduced:
`--foreground`, `--muted-foreground`, `--card`, `--divider`, `--cover-gold` /
`--selected` (highlight mark), `font-display` (Cinzel, used sparingly — not for every
label, per the final mock), `font-serif`/`font-reading` (Literata, snippets), `font-ui`
(Plus Jakarta Sans, everything else). No new hex values, matching the reconciliation
decision made early in this design pass (the Figma draft's cool slate-gray was replaced
with the app's real warm foreground/muted-foreground from the start).

## Components

- Rows and layout: new, feature-local components under
  `src/features/library/components/` — no existing primitive matches this shape.
- No new `components/ui/` primitive needed — the segmented control that would have
  required one (no existing tabs/toggle-group in the kit) was cut from scope.
- Search input: reuse styling conventions from the existing `input-folio` utility class
  rather than introducing a new input variant.

## Interaction (Day 4 reader-integration, referenced not specified here)

- Clicking a content-match row (has a chapter) navigates to the reader and jumps to that
  chapter — thin wrapper around the existing `jumpToTocItem()` primitive, per
  `docs/tasks/SPRINT-06-TASKS.md` Day 4 item 13.
- Clicking a metadata-only row (book match, no chapter) opens the book normally (existing
  "open book" action) — there's no specific chapter target to jump to.
- Highlighting the matched word inside the mounted reader chapter, and back-navigation
  after a jump, are separate Day 4 items (14, 15) — not part of this screen's own spec,
  just noting the results screen is what those items jump _from_.

## Out of scope / deferred

- Relevance/Book/Chapter sort control — cut, see Data contract section above.
- Multi-word snippet highlighting — the search engine only supports single-word
  extraction; matching the engine's real capability, not the mocks' aspirational
  multi-word highlight.
- Debouncing the live-filter input — not addressed here; follow whatever pattern
  `use-library-screen.ts`'s existing inline search already uses (if any), don't invent a
  new one.
