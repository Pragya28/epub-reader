import { type FC } from "react";
import {
  BookOpenIcon,
  BooksIcon,
  ClockIcon,
  UsersIcon,
} from "@phosphor-icons/react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { BookWithProgress } from "../types/library.types";
import { BookCover } from "@/components/book-cover/book-cover";
import {
  formatReadingProgress,
  formatReadingTime,
  formatSeriesLink,
} from "../utils/format-book-details";

interface AboutBookSheetProps {
  book: BookWithProgress;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasMoreByAuthor: boolean;
  onMoreByAuthor: () => void;
  /** True once this book's series has more than one book in the library —
   * same bar `useBookCard`'s "View Series" menu item gates on. */
  hasSeriesLink?: boolean;
  /** How many books in the library share this book's seriesName — needed
   * alongside book.seriesIndex for the "X/Y of {series}" label. */
  seriesBookCount?: number;
  onViewSeries?: () => void;
}

export const AboutBookSheet: FC<AboutBookSheetProps> = ({
  book,
  open,
  onOpenChange,
  hasMoreByAuthor,
  onMoreByAuthor,
  hasSeriesLink,
  seriesBookCount,
  onViewSeries,
}) => {
  const progressText = formatReadingProgress(book);
  const readingTimeText = book.readingTimeMinutes
    ? formatReadingTime(book.readingTimeMinutes)
    : null;
  const seriesLinkText =
    hasSeriesLink && book.seriesName && seriesBookCount !== undefined
      ? formatSeriesLink(book.seriesName, book.seriesIndex, seriesBookCount)
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl border-t bg-card p-0"
      >
        <SheetTitle className="sr-only">About {book.title}</SheetTitle>

        {/* Cover + title stay outside the ScrollArea below, so they're
            always visible rather than scrolling away with the description —
            the sheet's one fixed point of reference while the rest scrolls. */}
        <div className="flex shrink-0 gap-4 border-b border-divider p-6 pb-4">
          <div className="w-24 shrink-0 aspect-2/3 overflow-hidden rounded-xl border border-border/40 elevated-soft">
            <BookCover
              id={book.id}
              title={book.title}
              author={book.author}
              coverUrl={book.coverBg}
            />
          </div>

          <div className="flex min-w-0 flex-col justify-center gap-1">
            <p className="font-bold text-title-sm leading-tight text-foreground wrap-break-word">
              {book.title}
            </p>
            {book.author && (
              <p className="text-ui-sm text-muted-foreground wrap-break-word">
                {book.author}
              </p>
            )}
          </div>
        </div>

        {/* max-h-[85dvh] on SheetContent caps the sheet's height, but
            doesn't make overflow scroll on its own — a long description
            (or just a small viewport) got silently clipped at the bottom
            with no way to read the rest. ScrollArea here, not on
            SheetContent itself, keeps the close button (rendered by Sheet
            outside this tree) and the header above fixed in place rather
            than scrolling away. */}
        <ScrollArea className="flex-1 overflow-auto">
          <div className="flex flex-col gap-5 p-6 pt-4">
            {(progressText || readingTimeText) && (
              <div className="flex flex-col gap-2 text-ui-sm text-muted-foreground">
                {progressText && (
                  <div className="flex items-center gap-2">
                    <BookOpenIcon size={16} />
                    <span>{progressText}</span>
                  </div>
                )}
                {readingTimeText && (
                  <div className="flex items-center gap-2">
                    <ClockIcon size={16} />
                    <span>{readingTimeText}</span>
                  </div>
                )}
              </div>
            )}

            {book.description && (
              <p
                className={`text-ui text-foreground/80 leading-relaxed whitespace-pre-line ${
                  progressText || readingTimeText
                    ? "border-t border-divider pt-4"
                    : ""
                }`}
              >
                {book.description}
              </p>
            )}

            {(seriesLinkText || hasMoreByAuthor) && (
              <div className="flex flex-col items-start gap-1">
                {seriesLinkText && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full min-w-0 justify-start py-1.5 text-left whitespace-normal"
                    onClick={() => {
                      onOpenChange(false);
                      onViewSeries?.();
                    }}
                  >
                    <BooksIcon size={16} className="shrink-0" />
                    {seriesLinkText}
                  </Button>
                )}

                {hasMoreByAuthor && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full min-w-0 justify-start py-1.5 text-left whitespace-normal"
                    onClick={() => {
                      onOpenChange(false);
                      onMoreByAuthor();
                    }}
                  >
                    <UsersIcon size={16} className="shrink-0" />
                    More by {book.author}
                  </Button>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
