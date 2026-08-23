import { ROUTES } from "@/utils/routes";
import type { FC } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useLibraryScreen } from "@/features/library/hooks/use-library-screen";
import { BookGrid } from "@/features/library/components/book-grid";
import {
  FilterSheet,
  type FilterSheetSection,
} from "@/features/library/components/filter-sheet";
import { SortFilterButton } from "@/features/library/components/sort-filter-button";
import { ContinueReadingBanner } from "@/features/library/components/continue-reading-banner";
import { LibraryFab } from "@/features/library/components/library-fab";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    nextBook,
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
  const navigate = useNavigate();
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
      <main className="flex-1 pt-(--header-height) pb-36">
        <div className="sticky top-0 z-40 bg-background px-4">
          <Tabs
            value={isShelves ? "shelves" : "books"}
            onValueChange={(value) =>
              navigate(
                value === "shelves" ? ROUTES.LIBRARY_SHELVES : ROUTES.LIBRARY,
              )
            }
            className="pb-5"
          >
            <TabsList variant="line" aria-label="Library sections">
              <TabsTrigger value="books">Books</TabsTrigger>
              <TabsTrigger value="shelves">Shelves</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="px-4">
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
        </div>
      </main>

      {/* ── Continue Reading — fixed, fills width minus FAB ─────────────── */}
      {currentBook &&
        (currentBook.isFinished ? (
          nextBook && (
            <ContinueReadingBanner book={nextBook} label="Next book" />
          )
        ) : (
          <ContinueReadingBanner book={currentBook} />
        ))}

      {/* ── FAB — fixed bottom-right ─────────────────────────────────────── */}
      <LibraryFab />

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
