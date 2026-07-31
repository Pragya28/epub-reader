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
import { TableOfContents } from "lucide-react";
import { memo, useMemo, useState } from "react";

interface TocDrawerProps {
  toc: TocItem[];
  currentChapterIndex: number;
  onItemClick: (item: TocItem) => void;
}

export const TocDrawer = memo(function TocDrawer({
  toc,
  currentChapterIndex,
  onItemClick,
}: TocDrawerProps) {
  const flatItems = useMemo(() => flattenToc(toc, 0), [toc]);
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Table of contents"
            disabled={toc.length === 0}
          >
            <TableOfContents className="size-5" strokeWidth={1.5} />
          </Button>
        }
      />
      <SheetContent
        side="bottom"
        className="flex max-h-[85dvh] flex-col rounded-t-3xl border-t bg-card p-0"
        showCloseButton={false}
      >
        <SheetHeader className="border-b border-border px-6 pt-3 pb-5">
          <div className="mx-auto mb-4 h-1 w-16 rounded-full bg-border" />

          <SheetTitle className="font-heading text-base font-semibold tracking-[0.18em] text-center">
            Contents
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="flex flex-col gap-2 px-2 py-2">
            {flatItems.map(({ item }) => {
              const isActive = item.chapterIndex === currentChapterIndex;
              const isNavigable = item.chapterIndex >= 0;

              return (
                <Button
                  key={item.href}
                  variant={isActive ? "secondary" : "ghost"}
                  disabled={!isNavigable}
                  className="h-auto w-full justify-center whitespace-normal px-5 py-3 text-center"
                  onClick={() => {
                    if (!isNavigable) return;
                    onItemClick(item);
                    setOpen(false);
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
