import type { FC } from "react";
import { Link } from "react-router-dom";
import { CaretLeftIcon } from "@phosphor-icons/react";

import { ROUTES } from "@/utils/routes";
import { Button } from "@/components/ui/button";
import { BookGrid } from "@/features/library/components/book-grid";
import { FilterSheet } from "@/features/library/components/filter-sheet";
import { SortFilterButton } from "@/features/library/components/sort-filter-button";
import { useAuthorScreen } from "@/features/library/hooks/use-author-screen";
import {
  buildLibraryFilterSections,
  buildSortSection,
} from "@/features/library/utils/filter-sections";

export const LibraryAuthorScreen: FC = () => {
  const {
    author,
    isLoading,
    error,
    books,
    isFiltering,
    filterOpen,
    setFilterOpen,
    sortBy,
    setSortBy,
    filters,
    setFilters,
    resetFilters,
    languages,
  } = useAuthorScreen();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="folio-header sticky top-0 z-50 flex items-center gap-1 px-5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to library"
          render={<Link to={ROUTES.LIBRARY} />}
        >
          <CaretLeftIcon weight="light" className="size-6" />
        </Button>
        <span className="section-title font-semibold text-foreground mr-auto truncate">
          {author}
        </span>
        <SortFilterButton
          isFiltering={isFiltering}
          onClick={() => setFilterOpen(true)}
        />
      </header>

      <main className="flex-1 px-4 pt-5 pb-10">
        <BookGrid
          isLoading={isLoading}
          isSearch={isFiltering}
          error={error}
          books={books}
          hideMoreByAuthor
        />
      </main>

      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Sort & Filter"
        sections={[
          buildSortSection(sortBy, setSortBy),
          ...buildLibraryFilterSections(filters, setFilters, languages),
        ]}
        onReset={resetFilters}
        showReset={isFiltering}
      />
    </div>
  );
};
