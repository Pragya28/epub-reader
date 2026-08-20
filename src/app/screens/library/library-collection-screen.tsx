import type { FC } from "react";
import { EllipsisVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GroupingDetailScreen } from "@/features/library/components/grouping-detail-screen";
import { CollectionNameSheet } from "@/features/library/components/collections/collection-name-sheet";
import { ConfirmDeleteDialog } from "@/features/library/components/confirm-delete-dialog";
import { useCollectionDetailScreen } from "@/features/library/hooks/use-collection-detail-screen";
import { buildLibraryFilterSections } from "@/features/library/utils/filter-sections";

export const LibraryCollectionScreen: FC = () => {
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
    renameOpen,
    setRenameOpen,
    rename,
    deleteOpen,
    setDeleteOpen,
    confirmDelete,
    removeBook,
  } = useCollectionDetailScreen();

  return (
    <>
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
        onRemoveFromCollection={(bookId) => void removeBook(bookId)}
        emptyTitle="This shelf is empty"
        emptyDescription="Add books to this collection from a book's menu."
        headerEnd={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Collection options"
                />
              }
            >
              <EllipsisVertical strokeWidth={1.5} className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <CollectionNameSheet
        open={renameOpen}
        onOpenChange={setRenameOpen}
        initialName={groupingName ?? ""}
        onSubmit={rename}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        title={`Delete "${groupingName}"?`}
        description="This will delete the grouping. Your books will remain safe in your library."
        onConfirm={confirmDelete}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
};
