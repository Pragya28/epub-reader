import { type FC } from "react";
import { BookOpenIcon, ClockIcon, UsersIcon } from "@phosphor-icons/react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { BookWithProgress } from "../types/library.types";
import { BookCover } from "./book-card/book-cover";
import {
  formatReadingProgress,
  formatReadingTime,
} from "../utils/format-book-details";

interface AboutBookSheetProps {
  book: BookWithProgress;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasMoreByAuthor: boolean;
  onMoreByAuthor: () => void;
}

export const AboutBookSheet: FC<AboutBookSheetProps> = ({
  book,
  open,
  onOpenChange,
  hasMoreByAuthor,
  onMoreByAuthor,
}) => {
  const progressText = formatReadingProgress(book);
  const readingTimeText = book.readingTimeMinutes
    ? formatReadingTime(book.readingTimeMinutes)
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85dvh] flex-col gap-5 rounded-t-3xl border-t bg-card p-6 pt-8"
      >
        <SheetTitle className="sr-only">About {book.title}</SheetTitle>

        <div className="flex gap-4">
          <div className="w-24 shrink-0 aspect-2/3 overflow-hidden rounded-lg border border-border/40 elevated-soft">
            <BookCover {...book} />
          </div>

          <div className="flex min-w-0 flex-col justify-center gap-1">
            <p className="font-bold text-title-sm leading-tight text-foreground">
              {book.title}
            </p>
            {book.author && (
              <p className="text-ui-sm text-muted-foreground">{book.author}</p>
            )}
          </div>
        </div>

        {(progressText || readingTimeText) && (
          <div className="flex flex-col gap-2 border-t border-divider pt-4 text-ui-sm text-muted-foreground">
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
          <p className="border-t border-divider pt-4 text-ui text-foreground/80 leading-relaxed whitespace-normal">
            {book.description}
          </p>
        )}

        {hasMoreByAuthor && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => {
              onOpenChange(false);
              onMoreByAuthor();
            }}
          >
            <UsersIcon size={16} />
            More by {book.author}
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
};
