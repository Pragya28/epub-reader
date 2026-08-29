import { memo, type FC } from "react";
import type { BookWithProgress } from "../../types/library.types";
import { BookCover } from "@/components/book-cover/book-cover";
import { Link } from "react-router-dom";
import { ROUTES } from "@/utils/routes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DotsThreeVerticalIcon } from "@phosphor-icons/react";
import { AboutBookSheet } from "../about-book-sheet";
import { useBookCard } from "../../hooks/use-book-card";
import { useAddToCollection } from "../../hooks/use-add-to-collection";
import { ConfirmDeleteDialog } from "../confirm-delete-dialog";
import { AddToCollectionSheet } from "../collections/add-to-collection-sheet";

// Wrapped in memo: BookGrid re-renders on every LibraryScreen update
// (search input, scroll-driven header toggle, etc.) — without this,
// every card would re-render even though its own book data didn't
// change. Effective now that use-library-screen.ts memoizes the list
// so each book's prop values stay referentially stable across renders.
interface BookCardProps extends BookWithProgress {
  hideMoreByAuthor?: boolean;
  onRemoveFromCollection?: (bookId: string) => void;
}

export const BookCard: FC<BookCardProps> = memo(function BookCard({
  hideMoreByAuthor,
  onRemoveFromCollection,
  ...book
}) {
  const { id, isNew, isFinished, author, title } = book;
  const {
    statusText,
    aboutOpen,
    setAboutOpen,
    deleteOpen,
    setDeleteOpen,
    confirmDelete,
    addToCollectionOpen,
    setAddToCollectionOpen,
    hasMoreByAuthor,
    openMoreByAuthor,
    menuItems,
  } = useBookCard(book, hideMoreByAuthor, onRemoveFromCollection);
  const { collections, selectedIds, toggle, createAndAdd } = useAddToCollection(
    id,
    addToCollectionOpen,
  );

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
          aspect-2/3
          overflow-hidden
          rounded-xl
          border border-border/40
          elevated-soft
          transition-shadow
          group-hover:shadow-lg
        "
      >
        <BookCover
          id={book.id}
          title={book.title}
          author={book.author}
          coverUrl={book.coverBg}
        />
        {isNew && (
          <div className="absolute top-0 right-0 bg-background/95 text-foreground text-meta font-bold uppercase tracking-[0.8px] px-2.5 py-1 rounded-bl-xl">
            NEW
          </div>
        )}
      </div>
      {/* Meta below cover */}
      <div className="flex items-start justify-between gap-0.5">
        <div className="flex flex-col gap-0.5 pr-1">
          {/* Title  */}
          <div
            className={[
              "flex-1 min-w-0 font-bold text-ui leading-tight text-foreground line-clamp-2",
              isFinished ? "line-through opacity-50" : "",
            ].join(" ")}
          >
            {title}
          </div>
          {/* Author */}
          {author && (
            <p className="min-w-0 text-ui-sm text-muted-foreground leading-snug line-clamp-1">
              {author}
            </p>
          )}

          {/* Reading progress text */}
          {statusText && (
            <p className="text-meta text-muted-foreground">{statusText}</p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More options"
            className="relative z-20 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring outline-none"
          >
            <DotsThreeVerticalIcon size={24} weight="light" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
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

      <AboutBookSheet
        book={book}
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        hasMoreByAuthor={hasMoreByAuthor}
        onMoreByAuthor={openMoreByAuthor}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        title={`Delete "${title}"?`}
        description="This removes the book, its cover, and your reading progress. This can't be undone."
        onConfirm={confirmDelete}
        onOpenChange={setDeleteOpen}
      />

      <AddToCollectionSheet
        open={addToCollectionOpen}
        onOpenChange={setAddToCollectionOpen}
        collections={collections}
        selectedIds={selectedIds}
        onToggle={toggle}
        onCreateAndAdd={createAndAdd}
      />
    </div>
  );
});
