import { type FC } from "react";
import type { BookWithProgress } from "../../types/library.types";
import { BookCover } from "./book-cover";
import { Link } from "react-router-dom";
import { ROUTES } from "@/utils/routes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EllipsisVertical } from "lucide-react";
import { AboutBookSheet } from "../about-book-sheet";
import { useBookCard } from "../../hooks/use-book-card";
import { DeleteBookDialog } from "./delete-book-dialog";

export const BookCard: FC<BookWithProgress> = (book) => {
  const { id, isNew, isFinished, author, title } = book;
  const {
    statusText,
    aboutOpen,
    setAboutOpen,
    deleteOpen,
    setDeleteOpen,
    confirmDelete,
    menuItems,
  } = useBookCard(book);

  return (
    <div className="group relative z-0 flex flex-col gap-2">
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
          aspect-3/4
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
              {menuItems.map((entry) =>
                entry.type === "separator" ? (
                  <DropdownMenuSeparator key={entry.id} />
                ) : (
                  <DropdownMenuItem
                    key={entry.id}
                    variant={entry.variant}
                    onClick={entry.onClick}
                  >
                    {entry.label}
                  </DropdownMenuItem>
                ),
              )}
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

      <DeleteBookDialog
        open={deleteOpen}
        title={title}
        onConfirm={confirmDelete}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
};
