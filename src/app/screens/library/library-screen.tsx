import { ROUTES } from "@/utils/routes";
import type { FC } from "react";
import { Link, useLocation } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useLibraryScreen } from "@/features/library/hooks/use-library-screen";
import { BookGrid } from "@/features/library/components/book-grid";
import {
  FilterSheet,
  type FilterSheetSection,
} from "@/features/library/components/filter-sheet";
import { SortFilterButton } from "@/features/library/components/sort-filter-button";
import { ContinueReadingBanner } from "@/features/library/components/continue-reading-banner";
import { ImportBookFab } from "@/features/library/components/import-book-fab";
import { shelvesStore } from "@/features/library/store/shelves-store";
import { ShelvesGrid } from "@/features/library/components/shelves/shelves-grid";
import {
  buildLibraryFilterSections,
  buildSortSection,
} from "@/features/library/utils/filter-sections";
import type {
  ShelvesSortOption,
  ShelvesViewMode,
} from "@/features/library/utils/sort-groupings";
import { Search, Settings } from "lucide-react";
import { WordMark } from "@/assets/word-mark";
import { Button } from "@/components/ui/button";

const SHELVES_SORT_OPTIONS: { value: ShelvesSortOption; label: string }[] = [
  { value: "alphabetical", label: "A–Z" },
  { value: "createdAt", label: "Created" },
  { value: "updatedAt", label: "Updated" },
];

const VIEW_MODE_OPTIONS: { value: ShelvesViewMode; label: string }[] = [
  { value: "merged", label: "Merged" },
  { value: "grouped", label: "Grouped" },
];

export const LibraryScreen: FC = () => {
  const {
    isLoading,
    error,
    currentBook,
    visibleBooks,
    isFiltering,
    headerVisible,
    revealHeader,
    filterOpen,
    setFilterOpen,
    sortBy,
    setSortBy,
    filters,
    setFilters,
    resetFilters,
    languages,
  } = useLibraryScreen();

  const location = useLocation();
  const isShelves = location.pathname === ROUTES.LIBRARY_SHELVES;

  const {
    sortBy: shelvesSortBy,
    viewMode: shelvesViewMode,
    setSortBy: setShelvesSortBy,
    setViewMode: setShelvesViewMode,
  } = shelvesStore(
    useShallow((state) => ({
      sortBy: state.sortBy,
      viewMode: state.viewMode,
      setSortBy: state.setSortBy,
      setViewMode: state.setViewMode,
    })),
  );

  const shelvesSections: FilterSheetSection[] = [
    {
      type: "chips",
      key: "sort",
      label: "Sort By",
      options: SHELVES_SORT_OPTIONS,
      value: shelvesSortBy,
      onChange: (value) => setShelvesSortBy(value as ShelvesSortOption),
    },
    {
      type: "chips",
      key: "view",
      label: "View",
      options: VIEW_MODE_OPTIONS,
      value: shelvesViewMode,
      onChange: (value) => setShelvesViewMode(value as ShelvesViewMode),
    },
  ];

  const bookSections: FilterSheetSection[] = [
    buildSortSection(sortBy, setSortBy),
    ...buildLibraryFilterSections(filters, setFilters, languages),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      {/* Fixed + transform/opacity only (matches the reader's chrome,
          Sprint 5 Day 3) — deliberately NOT animating height/grid-rows:
          an in-flow element whose own height is driven by scroll position
          fights the browser's scroll-anchoring (which "corrects" scrollY
          when layout above the viewport changes size), and mid-transition
          heights visibly squeeze the logo/icons. Taking the header out of
          flow avoids both. `<main>` gets padding-top equal to its height
          via the shared --header-height var so content starts below it. */}
      <header
        onFocusCapture={revealHeader}
        className={`folio-header fixed inset-x-0 top-0 z-50 flex items-center px-5 transition-[transform,opacity] duration-300 ease-out ${
          headerVisible
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <WordMark className="mr-auto h-16 w-auto shrink-0" />
        <nav className="flex items-center gap-1 text-foreground">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search"
            render={<Link to={ROUTES.SEARCH} />}
          >
            <Search strokeWidth={1.5} className="size-5" />
          </Button>
          <SortFilterButton
            isFiltering={
              isShelves
                ? shelvesSortBy !== "alphabetical" ||
                  shelvesViewMode !== "merged"
                : isFiltering
            }
            onClick={() => setFilterOpen(true)}
          />
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
      {/* Extra bottom padding keeps content clear of the fixed bottom bar;
          top padding clears the fixed header above. */}
      <main className="flex-1 px-4 pt-(--header-height) pb-36">
        <nav className="mb-5 flex gap-2" aria-label="Library sections">
          <Link
            to={ROUTES.LIBRARY}
            aria-current={!isShelves ? "page" : undefined}
            className={`text-ui font-semibold px-3 py-1.5 rounded-full transition-colors ${
              !isShelves
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Books
          </Link>
          <Link
            to={ROUTES.LIBRARY_SHELVES}
            aria-current={isShelves ? "page" : undefined}
            className={`text-ui font-semibold px-3 py-1.5 rounded-full transition-colors ${
              isShelves
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Shelves
          </Link>
        </nav>

        {isShelves ? (
          <ShelvesGrid />
        ) : (
          <BookGrid
            isLoading={isLoading}
            isSearch={isFiltering}
            error={error}
            books={visibleBooks}
          />
        )}
      </main>

      {/* ── Continue Reading — fixed, fills width minus FAB ─────────────── */}
      {currentBook && <ContinueReadingBanner book={currentBook} />}

      {/* ── FAB — fixed bottom-right ─────────────────────────────────────── */}
      <ImportBookFab />

      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title={isShelves ? "Sort & View" : "Sort & Filter"}
        sections={isShelves ? shelvesSections : bookSections}
        onReset={isShelves ? undefined : resetFilters}
        showReset={!isShelves && isFiltering}
      />
    </div>
  );
};
