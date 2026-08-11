# Search Day 4 — Results Screen + Reader Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the search results screen (per `superpowers/specs/2026-08-11-search-results-screen-design.md`) and wire it to the reader — clicking a chapter match jumps to that chapter and highlights the matched word; clicking a book match opens the book normally.

**Architecture:** A new `ROUTES.SEARCH` screen replaces the library's inline search toggle. It renders `searchLibrary()`'s two result lists (`metadataMatches`, `contentMatches`) as one row list. Clicking a content-match row navigates to the reader with `router` location state carrying `{ chapterIndex, word }`; the reader engine, on seeing that state, seeds its initial chapter (same mechanism `loadReaderBook` already uses to seed from saved progress) and highlights the word in the DOM once that chapter's section mounts, instead of restoring saved scroll position. Clicking a book-only row is a normal open-book navigation.

**Tech Stack:** React 19 + TypeScript + Vite, react-router-dom, Zustand, Vitest + jsdom, existing `services/search/*` (no changes needed there).

## Global Constraints

- Package manager is pnpm — never npm/yarn.
- `pnpm test:run` for one-shot test runs (not `pnpm test`, which is watch mode).
- No new dependencies — everything here is achievable with what's already installed (react-router-dom's `useLocation`/`navigate` state, existing DOM APIs).
- Reuse `aspect-2/3` cover pattern (`about-book-sheet.tsx`), the app's real CSS tokens (`--foreground`, `--muted-foreground`, `--card`, `--divider`, `--cover-gold`, `--selected`, `font-display`/`font-serif`/`font-ui`) — no new colors.
- `store` in a filename = Zustand store only; don't introduce one for this feature (plain hook state is enough, matching `useLibraryScreen`'s `searchOpen` pattern).
- Don't re-export one module's functions through another — import each directly from its defining module.
- Flex/grid children: space with `gap`, not per-child margins.
- Every non-trivial function gets a colocated test in `__tests__/`.

---

### Task 1: Add the `/search` route and wire the library header to it

**Files:**

- Modify: `src/utils/routes.ts`
- Modify: `src/app/screens/library-screen.tsx`
- Modify: `src/features/library/hooks/use-library-screen.ts`
- Modify: `src/app/router.tsx` (find the router config and add the new route — read it first to match its existing pattern)

**Interfaces:**

- Produces: `ROUTES.SEARCH = "/search"` — consumed by Task 1's own router wiring and Task 3's screen.

- [ ] **Step 1: Add the route constant**

In `src/utils/routes.ts`, add `SEARCH: "/search"` alongside the existing entries:

```ts
export const ROUTES = {
  LIBRARY: "/library",
  LIBRARY_AUTHOR: "/library/author/:author",
  READER: "/reader/:bookId",
  SEARCH: "/search",
  SETTINGS: "/settings",
};
```

- [ ] **Step 2: Read the router to learn its pattern**

Read `src/app/router.tsx` in full — note how `LIBRARY`/`READER`/`SETTINGS` are registered (route element wiring, any layout wrapper) so Task 3's screen registration matches exactly. Do not add the route element yet — that's Task 3's Step 2, once the screen component exists. This step is read-only, no diff.

- [ ] **Step 3: Remove the library's inline search toggle, point the icon at `/search`**

In `src/app/screens/library-screen.tsx`, replace the search `Button`'s `onClick`/icon-toggle behavior with a plain `Link` to `ROUTES.SEARCH` (matching how the adjacent Settings button already uses `render={<Link to={ROUTES.SETTINGS} />}`):

```tsx
<Button
  variant="ghost"
  size="icon"
  aria-label="Search"
  render={<Link to={ROUTES.SEARCH} />}
>
  <Search strokeWidth={1.5} className="size-5" />
</Button>
```

Remove the `searchOpen ? <X/> : <Search/>` conditional and the inline `<input>` block (the `searchOpen ? <input .../> : <h1>...</h1>` in `<main>`) — the `<h1>Your Personal Collection</h1>` becomes unconditional again.

- [ ] **Step 4: Strip search state out of `useLibraryScreen`**

In `src/features/library/hooks/use-library-screen.ts`, remove `searchOpen` state, `closeSearch`, `openSearch`, and the `isSearching`/`filterBooksByQuery` branch in `visibleBooks` (library grid goes back to being sort/filter-only, no query search — that's the search screen's job now). Remove the now-unused `query`/`setQuery`/`libraryFilterStore` destructuring **only if** `libraryFilterStore`'s `query` field isn't used elsewhere (grep for `libraryFilterStore` usages first — if something else reads `query`, leave the store field alone and just stop wiring it into this hook's return value).

- [ ] **Step 5: Update the library screen's destructuring to match**

In `library-screen.tsx`, remove `searchOpen`, `query`, `setQuery`, `openSearch`, `closeSearch`, `isSearching` from the `useLibraryScreen()` destructure and from the `BookGrid`'s `isSearch` prop (becomes `isSearch={isFiltering}`).

- [ ] **Step 6: Run existing library tests, fix fallout**

Run: `pnpm test:run src/features/library`
Expected: any test asserting the old inline-search behavior fails — update those tests to match (query search is no longer part of this screen); tests about sort/filter should still pass unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/utils/routes.ts src/app/screens/library-screen.tsx src/features/library/hooks/use-library-screen.ts src/features/library/hooks/__tests__/
git commit -m "refactor(library): remove inline search toggle, point search icon at new route"
```

---

### Task 2: Search screen data hook

**Files:**

- Create: `src/features/library/hooks/use-search-screen.ts`
- Test: `src/features/library/hooks/__tests__/use-search-screen.test.ts`

**Interfaces:**

- Consumes: `searchLibrary(books, query): Promise<LibrarySearchResults>` from `src/features/library/actions/search-library.ts` (`{ metadataMatches: BookWithProgress[], contentMatches: ChapterMatch[] }`); `libraryStore()` for `books`.
- Produces: `useSearchScreen()` returning `{ query, setQuery, metadataMatches, contentMatches, resultCount, isSearching }` — consumed by Task 3's screen component.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/library/hooks/__tests__/use-search-screen.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useSearchScreen } from "../use-search-screen";
import { libraryStore } from "../../store/library-store";
import type { BookWithProgress } from "../../types/library.types";

const book: BookWithProgress = {
  id: "b1",
  title: "The Weight of Forever",
  author: "Eleanor Vance",
  fileHash: "h1",
  createdAt: Date.now(),
} as BookWithProgress;

vi.mock("../../actions/search-library", () => ({
  searchLibrary: vi.fn(async (_books: unknown, query: string) => {
    if (!query.trim()) return { metadataMatches: [], contentMatches: [] };
    return {
      metadataMatches: [book],
      contentMatches: [
        { bookId: "b1", chapter: 2, matchedWords: ["eternity"] },
      ],
    };
  }),
}));

describe("useSearchScreen", () => {
  beforeEach(() => {
    libraryStore.setState({ books: [book], isLoading: false, error: null });
  });

  it("returns empty results for an empty query", () => {
    const { result } = renderHook(() => useSearchScreen());
    expect(result.current.metadataMatches).toEqual([]);
    expect(result.current.contentMatches).toEqual([]);
    expect(result.current.resultCount).toBe(0);
    expect(result.current.isSearching).toBe(false);
  });

  it("populates results once a query is set", async () => {
    const { result } = renderHook(() => useSearchScreen());

    act(() => result.current.setQuery("weight of eternity"));

    await waitFor(() => expect(result.current.resultCount).toBe(2));
    expect(result.current.metadataMatches).toEqual([book]);
    expect(result.current.contentMatches).toHaveLength(1);
    expect(result.current.isSearching).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/features/library/hooks/__tests__/use-search-screen.test.ts`
Expected: FAIL — `use-search-screen` module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/features/library/hooks/use-search-screen.ts
import { useEffect, useState } from "react";
import { libraryStore } from "../store/library-store";
import { searchLibrary } from "../actions/search-library";
import type { LibrarySearchResults } from "../actions/search-library";

const EMPTY_RESULTS: LibrarySearchResults = {
  metadataMatches: [],
  contentMatches: [],
};

/**
 * Data layer behind the search results screen: live-filters the library as
 * the query changes. Kept separate from the screen component so it stays
 * presentational, matching useLibraryScreen/useReaderScreen.
 */
export function useSearchScreen() {
  const { books } = libraryStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LibrarySearchResults>(EMPTY_RESULTS);

  const trimmed = query.trim();
  const isSearching = trimmed !== "";

  useEffect(() => {
    if (!isSearching) {
      setResults(EMPTY_RESULTS);
      return;
    }

    let cancelled = false;
    void searchLibrary(books, query).then((next) => {
      if (!cancelled) setResults(next);
    });

    return () => {
      cancelled = true;
    };
  }, [books, query, isSearching]);

  return {
    query,
    setQuery,
    metadataMatches: results.metadataMatches,
    contentMatches: results.contentMatches,
    resultCount: results.metadataMatches.length + results.contentMatches.length,
    isSearching,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/features/library/hooks/__tests__/use-search-screen.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/library/hooks/use-search-screen.ts src/features/library/hooks/__tests__/use-search-screen.test.ts
git commit -m "feat(search): add search screen data hook"
```

---

### Task 3: Search screen UI — layout, rows, empty state

**Files:**

- Create: `src/features/library/components/search-result-row.tsx`
- Create: `src/app/screens/search-screen.tsx`
- Modify: `src/app/router.tsx` (register the route, per Task 1 Step 2's findings)
- Test: `src/features/library/components/__tests__/search-result-row.test.tsx`

**Interfaces:**

- Consumes: `useSearchScreen()` from Task 2; `getBookCoverUrl(bookId)` from `@/services/storage/book-repository` (same helper `use-reader-screen.ts` already uses); `getChapterSnippet(file, chapterIndex, word)` from `@/services/search/snippet`; `getBookWithFile(bookId)` from `@/services/storage/book-repository` (needed to get the `file` blob for snippet extraction — check its exact export name/signature by reading `src/services/storage/book-repository.ts` before writing this task's code, since it's referenced but not yet inspected in this plan).
- Produces: `<SearchResultRow>` component consumed by `search-screen.tsx`; the `/search` route.

- [ ] **Step 1: Read `book-repository.ts` to confirm exact function signatures**

Read `src/services/storage/book-repository.ts` in full. Confirm the exact exported names/signatures for: getting a book's cover URL (used already as `getBookCoverUrl(bookId): Promise<string | undefined>` per `use-reader-screen.ts`), and getting a book's file blob (`getBookWithFile` per `load-reader-book.ts`, returning `{ book, file }` — confirm the exact field name for the blob). Use these exact names in Steps 3–4 below; if they differ from what's assumed here, adjust the code accordingly rather than guessing.

- [ ] **Step 2: Register the route**

In `src/app/router.tsx`, add a route entry for `ROUTES.SEARCH` pointing at the new `SearchScreen`, following the exact pattern found in Task 1 Step 2 (same layout wrapper, same route-object shape as the existing three routes).

- [ ] **Step 3: Write the failing row component test**

```tsx
// src/features/library/components/__tests__/search-result-row.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SearchResultRow } from "../search-result-row";

describe("SearchResultRow", () => {
  it("renders a book-only match without chapter/snippet lines", () => {
    render(
      <SearchResultRow
        title="The Weight of Forever"
        author="Eleanor Vance"
        coverUrl={undefined}
      />,
    );
    expect(screen.getByText("The Weight of Forever")).toBeInTheDocument();
    expect(screen.getByText("Eleanor Vance")).toBeInTheDocument();
    expect(screen.queryByText(/chapter/i)).not.toBeInTheDocument();
  });

  it("renders a chapter match with the matched word highlighted", () => {
    render(
      <SearchResultRow
        title="The Alchemist's Silence"
        author="Elena Thorne"
        coverUrl={undefined}
        chapterLabel="The Golden Echo"
        snippet="the immense weight of eternity seemed"
        highlightWord="eternity"
      />,
    );
    expect(screen.getByText("The Golden Echo")).toBeInTheDocument();
    expect(screen.getByText("eternity")).toBeInTheDocument();
    expect(screen.getByText("eternity").tagName).toBe("MARK");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm test:run src/features/library/components/__tests__/search-result-row.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement `SearchResultRow`**

Case-insensitive single-word split for the highlight — mirrors `extractSnippet`'s case-insensitive matching so the rendered highlight lines up with what the service actually found:

```tsx
// src/features/library/components/search-result-row.tsx
import type { FC } from "react";

interface SearchResultRowProps {
  title: string;
  author: string;
  coverUrl: string | undefined;
  chapterLabel?: string;
  snippet?: string;
  highlightWord?: string;
  onClick?: () => void;
}

function renderSnippet(snippet: string, highlightWord?: string) {
  if (!highlightWord) return snippet;

  const index = snippet.toLowerCase().indexOf(highlightWord.toLowerCase());
  if (index === -1) return snippet;

  const before = snippet.slice(0, index);
  const match = snippet.slice(index, index + highlightWord.length);
  const after = snippet.slice(index + highlightWord.length);

  return (
    <>
      {before}
      <mark className="rounded-sm bg-cover-gold/35 not-italic font-semibold text-selected">
        {match}
      </mark>
      {after}
    </>
  );
}

export const SearchResultRow: FC<SearchResultRowProps> = ({
  title,
  author,
  coverUrl,
  chapterLabel,
  snippet,
  highlightWord,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full gap-3.5 py-3.5 text-left"
    >
      <div className="aspect-2/3 w-14 shrink-0 overflow-hidden rounded-sm bg-card shadow-sm">
        {coverUrl && (
          <img src={coverUrl} alt="" className="size-full object-cover" />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="font-ui text-sm font-semibold text-foreground">
          {title}
        </div>
        <div className="font-ui text-[10px] tracking-wide text-muted-foreground uppercase">
          {author}
        </div>
        {chapterLabel && (
          <div className="mt-1 font-ui text-[11px] tracking-wide text-muted-foreground">
            {chapterLabel}
          </div>
        )}
        {snippet && (
          <div className="mt-0.5 font-serif text-[15px] leading-snug text-foreground italic">
            {renderSnippet(snippet, highlightWord)}
          </div>
        )}
      </div>
    </button>
  );
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test:run src/features/library/components/__tests__/search-result-row.test.tsx`
Expected: PASS

- [ ] **Step 7: Implement the screen shell**

```tsx
// src/app/screens/search-screen.tsx
import { useEffect, useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search as SearchIcon, X } from "lucide-react";
import { ROUTES } from "@/utils/routes";
import { useSearchScreen } from "@/features/library/hooks/use-search-screen";
import { SearchResultRow } from "@/features/library/components/search-result-row";
import {
  getBookCoverUrl,
  getBookWithFile,
} from "@/services/storage/book-repository";
import { getChapterSnippet } from "@/services/search/snippet";
import type { ChapterMatch } from "@/services/search/search-content";
import { openBook } from "@/features/library/actions/open-book";

interface ContentMatchDisplay extends ChapterMatch {
  bookTitle: string;
  bookAuthor: string;
  coverUrl: string | undefined;
  chapterLabel: string;
  snippet: string;
}

export const SearchScreen: FC = () => {
  const navigate = useNavigate();
  const { query, setQuery, metadataMatches, contentMatches, resultCount } =
    useSearchScreen();

  const [metadataCovers, setMetadataCovers] = useState<Record<string, string>>(
    {},
  );
  const [contentDisplay, setContentDisplay] = useState<ContentMatchDisplay[]>(
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      metadataMatches.map(
        async (book) => [book.id, await getBookCoverUrl(book.id)] as const,
      ),
    ).then((pairs) => {
      if (cancelled) return;
      setMetadataCovers(Object.fromEntries(pairs.filter(([, url]) => url)));
    });
    return () => {
      cancelled = true;
    };
  }, [metadataMatches]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      contentMatches.map(async (match) => {
        const readerDoc = await getBookWithFile(match.bookId);
        if (!readerDoc) return null;
        const word = match.matchedWords[0];
        const [coverUrl, snippet] = await Promise.all([
          getBookCoverUrl(match.bookId),
          getChapterSnippet(readerDoc.file, match.chapter, word),
        ]);
        const chapterItem = readerDoc.book.toc?.find(
          (item) => item.chapterIndex === match.chapter,
        );
        return {
          ...match,
          bookTitle: readerDoc.book.title,
          bookAuthor: readerDoc.book.author ?? "",
          coverUrl,
          chapterLabel: chapterItem?.label ?? "",
          snippet,
        } satisfies ContentMatchDisplay;
      }),
    ).then((results) => {
      if (cancelled) return;
      setContentDisplay(
        results.filter((r): r is ContentMatchDisplay => r !== null),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [contentMatches]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-2.5 border-b border-divider px-4 py-3.5">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate(ROUTES.LIBRARY)}
          className="shrink-0 text-foreground"
        >
          <ArrowLeft className="size-5" strokeWidth={1.5} />
        </button>
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-card px-3 py-2.5">
          <SearchIcon
            className="size-4 shrink-0 text-muted-foreground"
            strokeWidth={1.5}
          />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your library"
            aria-label="Search your library"
            className="font-serif min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <X className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4">
        {query.trim() !== "" && (
          <p className="font-serif mb-5 text-[13px] text-muted-foreground italic">
            {resultCount} {resultCount === 1 ? "result" : "results"} found
          </p>
        )}

        <div className="flex flex-col divide-y divide-divider">
          {metadataMatches.map((book) => (
            <SearchResultRow
              key={book.id}
              title={book.title}
              author={book.author ?? ""}
              coverUrl={metadataCovers[book.id]}
              onClick={() => void openBook(book.id, navigate)}
            />
          ))}
          {contentDisplay.map((match) => (
            <SearchResultRow
              key={`${match.bookId}-${match.chapter}`}
              title={match.bookTitle}
              author={match.bookAuthor}
              coverUrl={match.coverUrl}
              chapterLabel={match.chapterLabel}
              snippet={match.snippet}
              highlightWord={match.matchedWords[0]}
              onClick={() =>
                navigate(ROUTES.READER.replace(":bookId", match.bookId), {
                  state: {
                    searchJump: {
                      chapterIndex: match.chapter,
                      word: match.matchedWords[0],
                    },
                  },
                })
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
};
```

**Note on `openBook`:** this plan assumes a reusable "open this book" navigation helper exists or is trivial (`navigate(ROUTES.READER.replace(":bookId", id))`). Grep for `openBook`/similar in `src/features/library/actions/` before writing this step — if nothing reusable exists, inline the two-line `navigate(ROUTES.READER.replace(":bookId", book.id))` directly in the `onClick` instead of importing a helper that doesn't exist.

- [ ] **Step 8: Manual smoke test**

Run `pnpm dev`, navigate to the library, click the search icon, confirm `/search` renders with the back button, input, and (once a query with results is typed) the row list with covers/snippets. This is UI work — per project convention, verify it live in the browser preview, not just via component tests.

- [ ] **Step 9: Commit**

```bash
git add src/app/screens/search-screen.tsx src/app/router.tsx src/features/library/components/search-result-row.tsx src/features/library/components/__tests__/search-result-row.test.tsx
git commit -m "feat(search): add search results screen"
```

---

### Task 4: Reader — accept an incoming search jump target

**Files:**

- Modify: `src/features/reader/actions/load-reader-book.ts`
- Modify: `src/features/reader/hooks/use-reader-screen.ts`
- Test: `src/features/reader/actions/__tests__/load-reader-book.test.ts` (extend existing file — read it first to match its existing test setup/mocks)

**Interfaces:**

- Consumes: `location.state.searchJump: { chapterIndex: number; word: string } | undefined` (react-router `useLocation`).
- Produces: `loadReaderBook(bookId, jumpChapterIndex?: number)` — when given, seeds `currentChapterIndex` to `jumpChapterIndex` instead of saved progress. `useReaderScreen()`'s return gains nothing new (the jump target flows straight into `useReaderEngine` in Task 5), but reads `location.state` internally.

- [ ] **Step 1: Read the existing `load-reader-book` test file**

Read `src/features/reader/actions/__tests__/load-reader-book.test.ts` in full to match its mocking pattern (how `getBookWithFile`/`EpubParser`/`readerStore` are mocked) before writing Step 2's test — don't invent a different mocking style.

- [ ] **Step 2: Write the failing test** (adapt the exact mock setup from Step 1; shape below)

```ts
it("seeds currentChapterIndex from jumpChapterIndex, overriding saved progress", async () => {
  // ...existing mock setup for getBookWithFile/parseBook returning a book
  // with savedProgress.chapterIndex = 1 and 5 total chapters...

  await loadReaderBook("book-1", 3);

  expect(readerStore.getState().currentChapterIndex).toBe(3);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test:run src/features/reader/actions/__tests__/load-reader-book.test.ts`
Expected: FAIL — extra argument currently has no effect (function still seeds from saved progress).

- [ ] **Step 4: Implement**

In `src/features/reader/actions/load-reader-book.ts`, add the optional param and let it take priority over saved progress:

```ts
export async function loadReaderBook(
  bookId: string,
  jumpChapterIndex?: number,
) {
  // ...unchanged through parsedBook/totalChapters...

  if (
    jumpChapterIndex !== undefined &&
    jumpChapterIndex >= 0 &&
    jumpChapterIndex < totalChapters
  ) {
    store.setCurrentChapterIndex(jumpChapterIndex);
  } else if (
    savedProgress &&
    savedProgress.chapterIndex >= 0 &&
    savedProgress.chapterIndex < totalChapters
  ) {
    store.setCurrentChapterIndex(savedProgress.chapterIndex);
    store.setProgressPercent(savedProgress.percent);
  }

  // ...rest unchanged...
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test:run src/features/reader/actions/__tests__/load-reader-book.test.ts`
Expected: PASS

- [ ] **Step 6: Wire `useReaderScreen` to read `location.state` and pass it through**

In `src/features/reader/hooks/use-reader-screen.ts`:

```ts
import { useLocation, useNavigate, useParams } from "react-router-dom";

interface SearchJumpState {
  searchJump?: { chapterIndex: number; word: string };
}

// inside useReaderScreen():
const location = useLocation();
const searchJump = (location.state as SearchJumpState | null)?.searchJump;
```

Change the mount effect's call from `loadReaderBook(bookId)` to `loadReaderBook(bookId, searchJump?.chapterIndex)`. Pass `searchJump` (the whole `{chapterIndex, word}` or `undefined`) into `useReaderEngine({ ..., searchJump })` — Task 5 consumes it.

Since `searchJump` is read from `location.state` (a ref-stable object only when the browser doesn't remount), and effects depending on it should only run once per navigation (not re-trigger on unrelated re-renders), don't add `searchJump` to the mount effect's own dependency array if it isn't already tracking `location.state` — the existing `[bookId]` dependency array for the load effect is correct as-is (the effect already runs once per `bookId` change, which is exactly when a new `searchJump` would also arrive, since jumping to a _different_ book's chapter always changes the route param).

- [ ] **Step 7: Commit**

```bash
git add src/features/reader/actions/load-reader-book.ts src/features/reader/actions/__tests__/load-reader-book.test.ts src/features/reader/hooks/use-reader-screen.ts
git commit -m "feat(reader): accept an incoming search-jump target to seed initial chapter"
```

---

### Task 5: Reader engine — skip restore and highlight the matched word when jumping in from search

**Files:**

- Create: `src/features/reader/engine/scroll/highlight-match.ts`
- Create: `src/features/reader/engine/scroll/__tests__/highlight-match.test.ts`
- Modify: `src/features/reader/hooks/use-reader-engine.ts`
- Modify: `src/constants/reader-iframe-styles.ts`

**Interfaces:**

- Produces: `highlightWordInSection(sectionEl: HTMLElement, word: string): HTMLElement | null` — wraps the first case-insensitive text-node match of `word` inside `sectionEl` in a `<mark class="search-highlight">`, returns the mark element (or `null` if not found). Pure DOM function, no store/iframe coupling, mirroring `chapter-loader.ts`'s "DOM-free where possible" pattern (this one necessarily touches DOM, but takes an already-resolved element, not an iframe/document).

- [ ] **Step 1: Write the failing test**

```ts
// src/features/reader/engine/scroll/__tests__/highlight-match.test.ts
import { describe, it, expect } from "vitest";
import { highlightWordInSection } from "../highlight-match";

describe("highlightWordInSection", () => {
  it("wraps the first case-insensitive match in a mark element", () => {
    const section = document.createElement("section");
    section.innerHTML =
      "<p>the immense weight of Eternity seemed to settle</p>";
    document.body.appendChild(section);

    const mark = highlightWordInSection(section, "eternity");

    expect(mark).not.toBeNull();
    expect(mark?.tagName).toBe("MARK");
    expect(mark?.classList.contains("search-highlight")).toBe(true);
    expect(mark?.textContent).toBe("Eternity");
    expect(section.textContent).toBe(
      "the immense weight of Eternity seemed to settle",
    );
  });

  it("returns null when the word isn't found", () => {
    const section = document.createElement("section");
    section.innerHTML = "<p>no match here</p>";
    document.body.appendChild(section);

    expect(highlightWordInSection(section, "eternity")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/features/reader/engine/scroll/__tests__/highlight-match.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/features/reader/engine/scroll/highlight-match.ts

/**
 * Finds the first case-insensitive occurrence of `word` in `sectionEl`'s
 * text and wraps it in a <mark class="search-highlight">, splitting the
 * containing text node around it. Single-word only, matching the search
 * engine's own single-word snippet extraction (services/search/snippet.ts) —
 * no multi-word phrase highlighting.
 */
export function highlightWordInSection(
  sectionEl: HTMLElement,
  word: string,
): HTMLElement | null {
  const lowerWord = word.toLowerCase();
  const walker = document.createTreeWalker(sectionEl, NodeFilter.SHOW_TEXT);

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent ?? "";
    const index = text.toLowerCase().indexOf(lowerWord);
    if (index === -1) continue;

    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + word.length);

    const mark = document.createElement("mark");
    mark.className = "search-highlight";
    range.surroundContents(mark);

    return mark;
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/features/reader/engine/scroll/__tests__/highlight-match.test.ts`
Expected: PASS

- [ ] **Step 5: Add the highlight style to the mirrored iframe token set**

Read `src/constants/reader-iframe-styles.ts` in full first, to match its existing token-mirroring convention (per `CLAUDE.md`'s note that this file hand-mirrors `index.css` tokens for the iframe). Add a rule using the same mirrored gold/selected values already present in that file for other gold-accented elements (e.g. the chapter separator) — do not introduce new hex values, reuse whatever mirrored custom property or literal color the file already uses for its warm-gold accent:

```css
mark.search-highlight {
  background: /* the file's existing mirrored gold-at-low-opacity value */;
  color: inherit;
  font-weight: 600;
  padding: 0 2px;
  border-radius: 2px;
}
```

- [ ] **Step 6: Wire into `useReaderEngine`**

In `src/features/reader/hooks/use-reader-engine.ts`:

1. Add `searchJump?: { chapterIndex: number; word: string }` to `UseReaderEngineProps` and the function's destructured params.
2. Import `highlightWordInSection` from `../engine/scroll/highlight-match`.
3. In `waitForInitialSections`, change the branch that currently reads:

```ts
if (!restoredInitialPosition && initialProgress) {
  restoredInitialPosition = true;
  restoreInitialPosition(iframeDoc, win, initialProgress);
} else {
  handleScroll();
}
```

to:

```ts
if (!restoredInitialPosition && searchJump) {
  restoredInitialPosition = true;
  const section = iframeDoc.querySelector(
    `section[data-chapter="${searchJump.chapterIndex}"]`,
  ) as HTMLElement | null;

  if (section) {
    store.setIsJumping(true);
    const targetY = win.scrollY + section.getBoundingClientRect().top;
    win.scrollTo(0, targetY);
    highlightWordInSection(section, searchJump.word);

    requestAnimationFrame(() => {
      store.setIsJumping(false);
      handleScroll();
    });
  } else {
    handleScroll();
  }
} else if (!restoredInitialPosition && initialProgress) {
  restoredInitialPosition = true;
  restoreInitialPosition(iframeDoc, win, initialProgress);
} else {
  handleScroll();
}
```

4. Add `searchJump` to the effect's dependency array (alongside `initialProgress`).

- [ ] **Step 7: Pass `searchJump` through `useReaderScreen`**

In `use-reader-screen.ts` (Task 4 already added the `searchJump` local variable), pass it into the `useReaderEngine({...})` call: `useReaderEngine({ ..., searchJump })`.

- [ ] **Step 8: Run the full reader test suite**

Run: `pnpm test:run src/features/reader`
Expected: PASS — existing restore/jump tests unaffected (the new branch only activates when `searchJump` is set, which no existing test sets).

- [ ] **Step 9: Manual smoke test**

Run `pnpm dev`, open the search screen, search a query with a known chapter match, click the result, confirm the reader opens directly at that chapter with the matched word visibly highlighted (not just scrolled to the top of the book). Then confirm pressing back returns to the search results (browser history — no new code needed, `goBack: () => navigate(-1)` in `use-reader-screen.ts` already does this since the search→reader navigation used `navigate()`, which pushes a history entry).

- [ ] **Step 10: Commit**

```bash
git add src/features/reader/engine/scroll/highlight-match.ts src/features/reader/engine/scroll/__tests__/highlight-match.test.ts src/features/reader/hooks/use-reader-engine.ts src/features/reader/hooks/use-reader-screen.ts src/constants/reader-iframe-styles.ts
git commit -m "feat(reader): highlight matched word and jump directly to chapter from search"
```

---

### Task 6: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Type-check**

Run: `pnpm build`
Expected: no TypeScript errors.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 3: Full test suite**

Run: `pnpm test:run`
Expected: all pass.

- [ ] **Step 4: Update `tasks/SPRINT-06-TASKS.md` Day 4 checkboxes**

Mark items 13, 14, 15 as ✅ (done) in `tasks/SPRINT-06-TASKS.md`'s Day 4 section, matching the file's existing ✅/🟡/❌ convention.

- [ ] **Step 5: Commit**

```bash
git add tasks/SPRINT-06-TASKS.md
git commit -m "docs: mark Sprint 6 Day 4 complete"
```
