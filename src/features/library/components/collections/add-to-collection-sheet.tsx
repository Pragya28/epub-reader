import { type FC, useState } from "react";
import { PlusIcon } from "@phosphor-icons/react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Grouping } from "@/services/storage/storage-types";
import { CollectionNameSheet } from "./collection-name-sheet";

interface AddToCollectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections: (Grouping & { bookCount: number })[];
  selectedIds: Set<string>;
  onToggle: (groupingId: string) => void;
  onCreateAndAdd: (name: string) => void;
}

export const AddToCollectionSheet: FC<AddToCollectionSheetProps> = ({
  open,
  onOpenChange,
  collections,
  selectedIds,
  onToggle,
  onCreateAndAdd,
}) => {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex max-h-[85dvh] flex-col rounded-t-3xl border-t bg-card"
        >
          <SheetHeader className="border-b">
            <SheetTitle className="normal-case tracking-normal">
              Add to Collection
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 p-4">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex w-full items-center gap-3 rounded-md p-3 text-left hover:bg-accent"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-input bg-muted">
                <PlusIcon className="size-4" />
              </span>
              <span className="text-ui-sm font-medium text-foreground">
                New Collection
              </span>
            </button>

            {collections.length > 0 && (
              <div className="my-2 h-px bg-border/40" />
            )}

            <ul className="flex flex-col gap-1">
              {collections.map((collection) => (
                <li key={collection.id}>
                  <label
                    htmlFor={`collection-${collection.id}`}
                    className="flex w-full items-center justify-between gap-3 rounded-md p-3 hover:bg-accent"
                  >
                    <span className="flex flex-col">
                      <span className="text-ui-sm font-medium text-foreground">
                        {collection.name}
                      </span>
                      <span className="text-meta font-semibold uppercase tracking-[0.6px] text-muted-foreground">
                        {collection.bookCount}{" "}
                        {collection.bookCount === 1 ? "Book" : "Books"}
                      </span>
                    </span>
                    <Checkbox
                      id={`collection-${collection.id}`}
                      checked={selectedIds.has(collection.id)}
                      onCheckedChange={() => onToggle(collection.id)}
                      className="size-7 rounded-md data-checked:border-selected data-checked:bg-selected data-checked:text-selected-foreground"
                    />
                  </label>
                </li>
              ))}
            </ul>
          </ScrollArea>

          <SheetFooter className="border-t">
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <CollectionNameSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={onCreateAndAdd}
      />
    </>
  );
};
