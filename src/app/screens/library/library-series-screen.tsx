import type { FC } from "react";
import { Link, Navigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { ROUTES } from "@/utils/routes";
import { Button } from "@/components/ui/button";
import { BookGrid } from "@/features/library/components/book-grid";
import { FilterSheet } from "@/features/library/components/filter-sheet";
import { SortFilterButton } from "@/features/library/components/sort-filter-button";
import { useSeriesDetailScreen } from "@/features/library/hooks/use-series-detail-screen";
import { buildLibraryFilterSections } from "@/features/library/utils/filter-sections";

export const LibrarySeriesScreen: FC = () => {
  const {
    groupingName,
    redirectToShelves,
    isLoading,
    error,
    books,
    isFiltering,
    filterOpen,
    setFilterOpen,
    filters,
    setFilters,
    resetFilters,
    languages,
  } = useSeriesDetailScreen();

  if (redirectToShelves) {
    return <Navigate to={ROUTES.LIBRARY_SHELVES} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="folio-header sticky top-0 z-50 flex items-center gap-1 px-5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to library"
          render={<Link to={ROUTES.LIBRARY_SHELVES} />}
        >
          <ChevronLeft strokeWidth={1.5} className="size-6" />
        </Button>
        <span className="section-title font-semibold text-foreground mr-auto truncate">
          {groupingName}
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
        />
      </main>

      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Filter"
        sections={buildLibraryFilterSections(filters, setFilters, languages)}
        onReset={resetFilters}
        showReset={isFiltering}
      />
    </div>
  );
};
