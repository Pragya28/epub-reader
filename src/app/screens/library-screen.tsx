import { ROUTES } from "@/utils/routes";
import type { FC } from "react";
import { Link } from "react-router-dom";
import { useLibraryScreen } from "@/features/library/hooks/use-library-screen";
import { BookGrid } from "@/features/library/components/book-grid";
import { LibraryFilterSheet } from "@/features/library/components/library-filter-sheet";
import { ContinueReadingBanner } from "@/features/library/components/continue-reading-banner";
import { ImportBookFab } from "@/features/library/components/import-book-fab";
import { Search, Settings, SlidersHorizontal, X } from "lucide-react";
import { WordMark } from "@/assets/word-mark";
import { Button } from "@/components/ui/button";

export const LibraryScreen: FC = () => {
  const {
    isLoading,
    currentBook,
    visibleBooks,
    isSearching,
    isFiltering,
    searchOpen,
    query,
    setQuery,
    openSearch,
    closeSearch,
    filterOpen,
    setFilterOpen,
    sortBy,
    setSortBy,
    filters,
    setFilters,
    resetFilters,
    languages,
  } = useLibraryScreen();

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
            onClick={() => (searchOpen ? closeSearch() : openSearch())}
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
        onReset={resetFilters}
        languages={languages}
      />
    </div>
  );
};
