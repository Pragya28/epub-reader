import { ROUTES } from "@/utils/routes";
import { useEffect, useMemo, useState, type FC } from "react";
import { Link } from "react-router-dom";
import { libraryStore } from "@/features/library/store/library-store";
import { loadLibrary } from "@/features/library/actions/load-library";
import {
  enrichBookWithProgress,
  pickCurrentlyReadingBook,
} from "@/features/library/utils/derive-book-status";
import {
  DEFAULT_LIBRARY_FILTERS,
  filterBooksByCriteria,
  filterBooksByQuery,
  hasActiveFilters,
} from "@/features/library/utils/filter-books";
import { DEFAULT_SORT, sortBooks } from "@/features/library/utils/sort-books";
import { BookGrid } from "@/features/library/components/book-grid";
import { LibraryFilterSheet } from "@/features/library/components/library-filter-sheet";
import { ContinueReadingBanner } from "@/features/library/components/continue-reading-banner";
import { ImportBookFab } from "@/features/library/components/import-book-fab";
import { Search, Settings, SlidersHorizontal, X } from "lucide-react";
import { WordMark } from "@/assets/word-mark";
import { Button } from "@/components/ui/button";

export const LibraryScreen: FC = () => {
  const { books, isLoading } = libraryStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState(DEFAULT_SORT);
  const [filters, setFilters] = useState(DEFAULT_LIBRARY_FILTERS);

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };

  useEffect(() => {
    void loadLibrary();

    // When the user navigates back from the reader, the reader's cleanup
    // flushes the final progress save to the DB. We listen for the page
    // becoming visible again so we re-fetch after that write has settled,
    // ensuring the progress bar and continue-reading banner reflect the
    // session that just ended.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadLibrary();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const enriched = books.map(enrichBookWithProgress);

  // Continue-reading always reflects the whole library, not whatever the
  // user currently has filtered/searched down to.
  const currentBook = pickCurrentlyReadingBook(enriched);

  const languages = useMemo(
    () =>
      Array.from(
        new Set(enriched.map((book) => book.language).filter(Boolean)),
      ) as string[],
    [enriched],
  );
  const authors = useMemo(
    () =>
      Array.from(
        new Set(enriched.map((book) => book.author).filter(Boolean)),
      ) as string[],
    [enriched],
  );

  const isFiltering = hasActiveFilters(filters);
  const isSearching = searchOpen && query.trim() !== "";

  const sorted = sortBooks(enriched, sortBy);
  const filtered = filterBooksByCriteria(sorted, filters);
  const visibleBooks = isSearching
    ? filterBooksByQuery(filtered, query)
    : filtered;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="folio-header sticky top-0 z-50 px-5 flex items-center">
        <WordMark className="mr-auto h-16 w-auto" />
        <nav className="flex items-center gap-1 text-foreground">
          <Button
            variant="ghost"
            size="icon"
            aria-label={searchOpen ? "Close search" : "Search"}
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          >
            {searchOpen ? (
              <X strokeWidth={1.5} className="size-5" />
            ) : (
              <Search strokeWidth={1.5} className="size-5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sort and filter"
            onClick={() => setFilterOpen(true)}
            className="relative"
          >
            <SlidersHorizontal strokeWidth={1.5} className="size-5" />
            {isFiltering && (
              <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            render={<Link to={ROUTES.SETTINGS} />}
          >
            <Settings strokeWidth={1.5} className="size-5" />
          </Button>
        </nav>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      {/* Extra bottom padding keeps content clear of the fixed bottom bar */}
      <main className="flex-1 px-4 pt-5 pb-36">
        {searchOpen ? (
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, author, or description"
            aria-label="Search your library"
            className="input-folio w-full text-ui text-foreground mb-5 py-2 placeholder:text-muted-foreground"
          />
        ) : (
          <div className="text-[22px] font-heading font-semibold text-foreground mb-5 leading-tight">
            Your Personal Collection
          </div>
        )}
        <BookGrid
          isLoading={isLoading}
          isSearch={isSearching || isFiltering}
          books={visibleBooks}
        />
      </main>

      {/* ── Continue Reading — fixed, fills width minus FAB ─────────────── */}
      {currentBook && <ContinueReadingBanner book={currentBook} />}

      {/* ── FAB — fixed bottom-right ─────────────────────────────────────── */}
      <ImportBookFab />

      <LibraryFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        filters={filters}
        onFiltersChange={setFilters}
        onReset={() => setFilters(DEFAULT_LIBRARY_FILTERS)}
        languages={languages}
        authors={authors}
      />
    </div>
  );
};
