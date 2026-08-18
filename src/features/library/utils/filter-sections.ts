import type { FilterSheetSection } from "../components/filter-sheet";
import type { LengthBucket, LibraryFilters } from "./filter-books";
import type { ReadingStatus } from "../types/library.types";
import type { SortOption } from "./sort-books";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recentlyImported", label: "Recently Imported" },
  { value: "recentlyOpened", label: "Recently Opened" },
  { value: "title", label: "Title (A–Z)" },
  { value: "author", label: "Author" },
  { value: "progress", label: "Reading Progress" },
  { value: "status", label: "Reading Status" },
];

const STATUS_OPTIONS: { value: ReadingStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "reading", label: "Reading" },
  { value: "finished", label: "Finished" },
];

const LENGTH_OPTIONS: { value: LengthBucket | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "short", label: "Short Reads" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
  { value: "epic", label: "Epic" },
];

export function buildSortSection(
  sortBy: SortOption,
  onSortByChange: (value: SortOption) => void,
): Extract<FilterSheetSection, { type: "chips" }> {
  return {
    type: "chips",
    key: "sort",
    label: "Sort By",
    options: SORT_OPTIONS,
    value: sortBy,
    onChange: (value) => onSortByChange(value as SortOption),
  };
}

/**
 * The filter half shared by every book-grid screen: Books tab, author
 * screen, and the series screen (Task 12) — the only difference between
 * them is whether buildSortSection's chip group is prepended, since a
 * series's order is fixed and never user-sortable.
 */
export function buildLibraryFilterSections(
  filters: LibraryFilters,
  onFiltersChange: (filters: LibraryFilters) => void,
  languages: string[],
): FilterSheetSection[] {
  const sections: FilterSheetSection[] = [
    {
      type: "chips",
      key: "status",
      label: "Reading Status",
      options: STATUS_OPTIONS,
      value: filters.status,
      onChange: (value) =>
        onFiltersChange({ ...filters, status: value as ReadingStatus | "all" }),
    },
    {
      type: "switch",
      key: "hideFinished",
      label: "Hide Finished Books",
      checked: filters.hideFinished,
      onChange: (checked) =>
        onFiltersChange({ ...filters, hideFinished: checked }),
    },
    {
      type: "chips",
      key: "length",
      label: "Book Length",
      options: LENGTH_OPTIONS,
      value: filters.length,
      onChange: (value) =>
        onFiltersChange({ ...filters, length: value as LengthBucket | "all" }),
    },
  ];

  if (languages.length > 1) {
    sections.push({
      type: "select",
      key: "language",
      label: "Language",
      value: filters.language,
      onChange: (value) => onFiltersChange({ ...filters, language: value }),
      options: [
        { value: "all", label: "All" },
        ...languages.map((language) => ({ value: language, label: language })),
      ],
    });
  }

  return sections;
}
