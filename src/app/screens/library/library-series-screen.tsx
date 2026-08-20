import type { FC } from "react";

import { GroupingDetailScreen } from "@/features/library/components/grouping-detail-screen";
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

  return (
    <GroupingDetailScreen
      groupingName={groupingName}
      redirectToShelves={redirectToShelves}
      isLoading={isLoading}
      error={error}
      books={books}
      isFiltering={isFiltering}
      filterOpen={filterOpen}
      setFilterOpen={setFilterOpen}
      filterSections={buildLibraryFilterSections(
        filters,
        setFilters,
        languages,
      )}
      onReset={resetFilters}
    />
  );
};
