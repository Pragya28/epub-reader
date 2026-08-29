import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TocItem } from "@/services/epub/epub-types";
import { flattenToc } from "../utils/flatten-toc";
import { ListBulletsIcon } from "@phosphor-icons/react";
import { memo, useMemo, useState } from "react";

interface TocDrawerProps {
  toc: TocItem[];
  currentChapterIndex: number;
  onItemClick: (item: TocItem) => void;
  onOpenChange?: (open: boolean) => void;
}

export const TocDrawer = memo(function TocDrawer({
  toc,
  currentChapterIndex,
  onItemClick,
  onOpenChange,
}: TocDrawerProps) {
  const flatItems = useMemo(() => flattenToc(toc, 0), [toc]);
  const [open, setOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Table of contents"
            disabled={toc.length === 0}
          >
            <ListBulletsIcon className="size-5" weight="light" />
          </Button>
        }
      />
      <SheetContent
        side="bottom"
        className="flex max-h-[85dvh] flex-col rounded-t-3xl border-t bg-card p-0"
        showCloseButton={false}
      >
        <SheetHeader className="gap-4 border-b border-border px-6 pt-3 pb-5">
          <div className="mx-auto h-1 w-16 rounded-full bg-border" />

          <SheetTitle className="text-center">Contents</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="flex flex-col gap-2 px-2 py-2">
            {flatItems.map(({ item, depth }, index) => {
              const isActive = item.chapterIndex === currentChapterIndex;
              const isNavigable = item.chapterIndex >= 0;

              return (
                <Button
                  key={`${item.href}-${index}`}
                  variant={isActive ? "secondary" : "ghost"}
                  disabled={!isNavigable}
                  className="h-auto w-full justify-start whitespace-normal py-3 pr-5 text-left"
                  style={{ paddingLeft: `${1.25 + depth * 1.25}rem` }}
                  onClick={() => {
                    if (!isNavigable) return;
                    onItemClick(item);
                    handleOpenChange(false);
                  }}
                  aria-current={isActive ? "true" : undefined}
                >
                  <span
                    className={`font-reading leading-tight italic ${
                      isActive ? "font-semibold" : ""
                    }`}
                  >
                    {item.label}
                  </span>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
});
