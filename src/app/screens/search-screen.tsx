import { useEffect, useMemo, useRef, useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon as SearchIcon,
  MagnifyingGlassMinusIcon,
  XIcon,
} from "@phosphor-icons/react";
import { ROUTES } from "@/utils/routes";
import { useSearchScreen } from "@/features/library/hooks/use-search-screen";
import {
  loadSearchResultDisplays,
  type BookCache,
  type BookMetaCache,
  type ContentMatchDisplay,
} from "@/features/library/actions/load-search-result-displays";
import { SearchResultRow } from "@/features/library/components/search-result-row";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SearchStatusFilter } from "@/features/library/utils/filter-search-results";
import { getBookCoverUrl } from "@/services/storage/book-repository";
import type { ChapterMatch } from "@/services/search/search-content";

/** Rows built per page. Each costs a chapter decompress + sanitize. */
const CONTENT_PAGE_SIZE = 10;

const SEARCH_STATUS_OPTIONS: { value: SearchStatusFilter; label: string }[] = [
  { value: "unfinished", label: "Unfinished" },
  { value: "all", label: "All" },
  { value: "finished", label: "Finished" },
];

export const SearchScreen: FC = () => {
  const navigate = useNavigate();
  const {
    query,
    setQuery,
    metadataMatches,
    contentMatches,
    resultCount,
    isLoading,
    isSearching,
    statusFilter,
    setStatusFilter,
    hiddenCount,
    needsMoreInput,
    minQueryLength,
  } = useSearchScreen();

  const [metadataCovers, setMetadataCovers] = useState<Record<string, string>>(
    {},
  );
  const [contentDisplay, setContentDisplay] = useState<ContentMatchDisplay[]>(
    [],
  );
  // Paging is tied to the match list it belongs to, so a new query restarts
  // at page one without a setState-in-effect (which the lint rules forbid,
  // and which would render one frame of the old page size).
  const [paging, setPaging] = useState<{
    forMatches: ChapterMatch[];
    count: number;
  }>({ forMatches: contentMatches, count: CONTENT_PAGE_SIZE });

  const visibleCount =
    paging.forMatches === contentMatches ? paging.count : CONTENT_PAGE_SIZE;

  const loadMoreRef = useRef<HTMLDivElement>(null);
  // bookCacheRef is only touched on a chapter-text cache miss (full parse
  // fallback); metaCacheRef is the common path (title/author/cover only).
  const bookCacheRef = useRef<BookCache>(new Map());
  const metaCacheRef = useRef<BookMetaCache>(new Map());

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      metadataMatches.map(
        async (book) => [book.id, await getBookCoverUrl(book.id)] as const,
      ),
    ).then((pairs) => {
      if (cancelled) return;
      setMetadataCovers(
        Object.fromEntries(
          pairs.filter((pair): pair is [string, string] => !!pair[1]),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [metadataMatches]);

  // Only build rows the user can actually reach. Each row still costs a
  // chapter decompress + sanitize (~25ms), so loading all 39 up front made
  // first paint wait on ~35 rows nobody had scrolled to yet.
  const visibleMatches = useMemo(
    () => contentMatches.slice(0, visibleCount),
    [contentMatches, visibleCount],
  );

  // Cleared per query, not per page — declared before the loader below so it
  // resets first when a new search arrives. Paging keeps the parsed book, so
  // "10 more rows" costs 10 chapter reads, not another full unzip.
  useEffect(() => {
    bookCacheRef.current = new Map();
    metaCacheRef.current = new Map();
  }, [contentMatches]);

  useEffect(() => {
    let cancelled = false;
    void loadSearchResultDisplays(
      visibleMatches,
      bookCacheRef.current,
      metaCacheRef.current,
    ).then((results) => {
      if (!cancelled) setContentDisplay(results);
    });
    return () => {
      cancelled = true;
    };
  }, [visibleMatches]);

  // Grows the window as the sentinel below the list scrolls into view.
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setPaging({
          forMatches: contentMatches,
          count: visibleCount + CONTENT_PAGE_SIZE,
        });
      }
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [contentMatches, visibleCount]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-2.5 border-b border-divider px-4 py-3.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          onClick={() => navigate(ROUTES.LIBRARY)}
          className="shrink-0 text-foreground"
        >
          <ArrowLeftIcon className="size-5" weight="light" />
        </Button>
        <div className="flex flex-1 items-center gap-2 rounded-md bg-card px-3 py-2.5 ring-1 ring-transparent focus-within:ring-ring/50">
          <SearchIcon
            className="size-4 shrink-0 text-muted-foreground"
            weight="light"
          />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your library"
            aria-label="Search your library"
            className="font-reading min-w-0 flex-1 bg-transparent text-title-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="shrink-0"
            >
              <XIcon
                className="size-3.5 text-muted-foreground"
                weight="light"
              />
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 py-4">
        {isSearching && (
          <ToggleGroup
            value={[statusFilter]}
            onValueChange={(next) => {
              const [picked] = next as SearchStatusFilter[];
              // Base UI clears the array when the active item is pressed
              // again; keep the current filter rather than falling into an
              // unlabelled fourth state.
              if (picked) setStatusFilter(picked);
            }}
            aria-label="Filter results by reading status"
            className="mb-4"
          >
            {SEARCH_STATUS_OPTIONS.map(({ value, label }) => (
              <ToggleGroupItem key={value} value={value} size="sm">
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {/* Suppressed at zero results — the empty view below says it better
            than "0 results found" stacked on top of it. */}
        {isSearching && (isLoading || resultCount > 0) && (
          <p className="font-reading mb-5 text-meta text-muted-foreground italic">
            {isLoading
              ? "Searching…"
              : `${resultCount} ${resultCount === 1 ? "result" : "results"} found${hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""}`}
          </p>
        )}

        {!isSearching && !needsMoreInput && (
          <Empty className="py-24">
            <EmptyHeader>
              <EmptyMedia>
                <SearchIcon
                  size={48}
                  weight="light"
                  className="text-muted-foreground/30"
                />
              </EmptyMedia>
              <EmptyTitle className="text-ui uppercase tracking-[0.15em] text-muted-foreground">
                Search your library
              </EmptyTitle>
              <EmptyDescription className="text-ui-sm opacity-60">
                Find a book by title or author, or search inside the text of
                every book you've imported.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {needsMoreInput && (
          <p
            role="status"
            aria-live="polite"
            className="font-reading text-meta text-muted-foreground italic"
          >
            Type at least {minQueryLength} characters to search.
          </p>
        )}

        {isSearching && !isLoading && resultCount === 0 && (
          <Empty role="status" aria-live="polite" className="py-24">
            <EmptyHeader>
              <EmptyMedia>
                <MagnifyingGlassMinusIcon
                  size={48}
                  weight="light"
                  className="text-muted-foreground/30"
                />
              </EmptyMedia>
              <EmptyTitle className="text-ui uppercase tracking-[0.15em] text-muted-foreground">
                No results found
              </EmptyTitle>
              <EmptyDescription className="text-ui-sm opacity-60">
                {hiddenCount > 0
                  ? `${hiddenCount} ${hiddenCount === 1 ? "result is" : "results are"} hidden by the current filter.`
                  : "Try a different word, or check the spelling."}
              </EmptyDescription>
            </EmptyHeader>
            {hiddenCount > 0 && (
              <EmptyContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusFilter("all")}
                >
                  Show all results
                </Button>
              </EmptyContent>
            )}
          </Empty>
        )}

        <div className="flex flex-col divide-y divide-divider">
          {metadataMatches.map((book) => (
            <SearchResultRow
              key={book.id}
              bookId={book.id}
              title={book.title}
              author={book.author ?? ""}
              coverUrl={metadataCovers[book.id]}
              onClick={() =>
                navigate(ROUTES.READER.replace(":bookId", book.id))
              }
            />
          ))}
          {contentDisplay.map((match) => (
            <SearchResultRow
              key={`${match.bookId}-${match.chapter}`}
              bookId={match.bookId}
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

        {/* Sentinel: scrolling to it builds the next page of rows. */}
        {visibleCount < contentMatches.length && (
          <div
            ref={loadMoreRef}
            aria-hidden
            className="h-10"
            data-testid="search-load-more"
          />
        )}
      </div>
    </div>
  );
};
