import { type FC, useState } from "react";
import type { BookWithProgress } from "../../types/library.types";
import { BookCover } from "./book-cover";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "@/utils/routes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EllipsisVertical } from "lucide-react";
import {
  markBookFinished,
  markBookUnread,
  startBookAtBeginning,
} from "../../actions/mark-book-status";
import { AboutBookSheet } from "../about-book-sheet";

export const BookCard: FC<BookWithProgress> = (book) => {
  const { id, isNew, isFinished, isReading, author, title, progress } = book;
  const navigate = useNavigate();
  const [aboutOpen, setAboutOpen] = useState(false);

  const statusText = isFinished
    ? "Finished"
    : isReading && progress !== undefined
      ? `${progress}% read`
      : null;

  return (
    <div className="group relative z-0 flex flex-col gap-2.5">
      {/* Stretched link: covers the whole card so any non-interactive area
          navigates to the reader, without nesting the dropdown's <button>
          inside an <a> (invalid HTML). The dropdown trigger below sits in
          a higher stacking context so it still receives its own clicks. */}
      <Link
        to={ROUTES.READER.replace(":bookId", id)}
        aria-label={title}
        className="absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:ring-ring outline-none"
      />
      <div
        className="
          relative
          aspect-2/3
          overflow-hidden
          rounded-xl
          border border-border/40
          elevated-soft
          transition-shadow
          group-hover:shadow-lg
        "
      >
        <BookCover {...book} />
        {isNew && (
          <div className="absolute top-0 right-0 bg-background/95 text-foreground text-[10px] font-bold uppercase tracking-[0.8px] px-2.5 py-1 rounded-bl-xl">
            NEW
          </div>
        )}
      </div>
      {/* Meta below cover */}
      <div className="flex flex-col gap-0.5 pr-1">
        {/* Title row */}
        <div className="flex items-start justify-between gap-0.5">
          <div
            className={[
              "flex-1 min-w-0 font-bold text-ui leading-tight text-foreground line-clamp-2",
              isFinished ? "line-through opacity-50" : "",
            ].join(" ")}
          >
            {title}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="More options"
              className="relative z-20 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring outline-none"
            >
              <EllipsisVertical size={24} strokeWidth={1.5} />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem
                onClick={() => navigate(ROUTES.READER.replace(":bookId", id))}
              >
                Open
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {!isFinished && (
                <DropdownMenuItem onClick={() => void markBookFinished(id)}>
                  Mark as Finished
                </DropdownMenuItem>
              )}

              {(isFinished || isReading) && (
                <DropdownMenuItem onClick={() => void markBookUnread(id)}>
                  Mark as Unread
                </DropdownMenuItem>
              )}

              {(isReading || isFinished) && (
                <DropdownMenuItem onClick={() => void startBookAtBeginning(id)}>
                  Start at Beginning
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => setAboutOpen(true)}>
                About Book
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Author */}
        {author && (
          <p className="text-ui-sm text-muted-foreground leading-snug">
            {author}
          </p>
        )}

        {/* Reading progress text */}
        {statusText && (
          <p className="text-meta text-muted-foreground mt-0.5">{statusText}</p>
        )}
      </div>

      <AboutBookSheet
        book={book}
        open={aboutOpen}
        onOpenChange={setAboutOpen}
      />
    </div>
  );
};
