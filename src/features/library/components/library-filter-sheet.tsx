import type { FC } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ReadingStatus } from "../types/library.types";
import {
  hasActiveFilters,
  type LengthBucket,
  type LibraryFilters,
} from "../utils/filter-books";
import { type SortOption } from "../utils/sort-books";

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

interface ChipGroupProps<T> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

function ChipGroup<T>({ label, options, value, onChange }: ChipGroupProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-meta uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={String(option.value)}
            type="button"
            variant={value === option.value ? "secondary" : "outline"}
            size="sm"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

interface LibraryFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sortBy: SortOption;
  onSortByChange: (value: SortOption) => void;
  filters: LibraryFilters;
  onFiltersChange: (filters: LibraryFilters) => void;
  onReset: () => void;
  languages: string[];
}

export const LibraryFilterSheet: FC<LibraryFilterSheetProps> = ({
  open,
  onOpenChange,
  sortBy,
  onSortByChange,
  filters,
  onFiltersChange,
  onReset,
  languages,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85dvh] flex-col rounded-t-3xl border-t bg-card p-0"
        showCloseButton={false}
      >
        <SheetHeader className="gap-4 border-b border-border px-6 pt-3 pb-5">
          <div className="mx-auto h-1 w-16 rounded-full bg-border" />

          <SheetTitle className="text-center">Sort &amp; Filter</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="flex flex-col gap-6 px-6 py-5">
            <ChipGroup
              label="Sort By"
              options={SORT_OPTIONS}
              value={sortBy}
              onChange={onSortByChange}
            />

            <ChipGroup
              label="Reading Status"
              options={STATUS_OPTIONS}
              value={filters.status}
              onChange={(status) => onFiltersChange({ ...filters, status })}
            />

            <div className="flex items-center justify-between">
              <label
                htmlFor="library-filter-hide-finished"
                className="text-meta uppercase tracking-[0.08em] text-muted-foreground"
              >
                Hide Finished Books
              </label>
              <Switch
                id="library-filter-hide-finished"
                checked={filters.hideFinished}
                onCheckedChange={(hideFinished) =>
                  onFiltersChange({ ...filters, hideFinished })
                }
              />
            </div>

            <ChipGroup
              label="Book Length"
              options={LENGTH_OPTIONS}
              value={filters.length}
              onChange={(length) => onFiltersChange({ ...filters, length })}
            />

            {languages.length > 1 && (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="library-filter-language"
                  className="text-meta uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Language
                </label>
                <select
                  id="library-filter-language"
                  className="input-folio text-ui text-foreground py-2"
                  value={filters.language}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, language: e.target.value })
                  }
                >
                  <option value="all">All</option>
                  {languages.map((language) => (
                    <option key={language} value={language}>
                      {language}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {hasActiveFilters(filters) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={onReset}
              >
                Clear filters
              </Button>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
