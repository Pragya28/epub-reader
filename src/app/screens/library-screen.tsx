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
    error,
    currentBook,
    visibleBooks,
    isSearching,
    isFiltering,
    headerVisible,
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
      {/* Grid-rows trick collapses the sticky header to zero height on
          scroll-down instead of just hiding it, so it doesn't leave dead
          space in the flow (see reader chrome — Sprint 5 Day 3). */}
      <div
        className={`sticky top-0 z-50 grid transition-[grid-template-rows] duration-300 ease-out ${
          headerVisible ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <header className="folio-header overflow-hidden min-h-0 px-5 flex items-center">
          <WordMark className="mr-auto h-16 w-auto shrink-0" />
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
      </div>

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
          <h1 className="section-title font-semibold text-foreground mb-5 leading-tight">
            Your Personal Collection
          </h1>
        )}
        <BookGrid
          isLoading={isLoading}
          isSearch={isSearching || isFiltering}
          error={error}
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
