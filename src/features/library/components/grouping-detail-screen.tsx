import type { FC, ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { ROUTES } from "@/utils/routes";
import { Button } from "@/components/ui/button";
import { BookGrid } from "@/features/library/components/book-grid";
import {
  FilterSheet,
  type FilterSheetSection,
} from "@/features/library/components/filter-sheet";
import { SortFilterButton } from "@/features/library/components/sort-filter-button";
import type { BookWithProgress } from "../types/library.types";

interface GroupingDetailScreenProps {
  groupingName: string | null;
  redirectToShelves: boolean;
  isLoading: boolean;
  error: string | null;
  books: BookWithProgress[];
  isFiltering: boolean;
  filterOpen: boolean;
  setFilterOpen: (open: boolean) => void;
  filterSections: FilterSheetSection[];
  onReset?: () => void;
  /** "⋮" rename/delete menu on the collection screen; absent on series,
   * which is read-only. */
  headerEnd?: ReactNode;
  hideMoreByAuthor?: boolean;
  onRemoveFromCollection?: (bookId: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

/**
 * Header + book grid + filter sheet shell shared by the series and
 * collection detail screens — identical layout, differing only in the
 * filter sections passed in and an optional header-end slot (the
 * collection screen's rename/delete menu).
 */
export const GroupingDetailScreen: FC<GroupingDetailScreenProps> = ({
  groupingName,
  redirectToShelves,
  isLoading,
  error,
  books,
  isFiltering,
  filterOpen,
  setFilterOpen,
  filterSections,
  onReset,
  headerEnd,
  hideMoreByAuthor,
  onRemoveFromCollection,
  emptyTitle,
  emptyDescription,
}) => {
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
        {headerEnd}
      </header>

      <main className="flex-1 px-4 pt-5 pb-10">
        <BookGrid
          isLoading={isLoading}
          isSearch={isFiltering}
          error={error}
          books={books}
          hideMoreByAuthor={hideMoreByAuthor}
          onRemoveFromCollection={onRemoveFromCollection}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        />
      </main>

      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Filter"
        sections={filterSections}
        onReset={onReset}
        showReset={isFiltering}
      />
    </div>
  );
};
