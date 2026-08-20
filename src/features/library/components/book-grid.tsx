import { memo, type FC } from "react";
import { BookCard } from "./book-card/book-card";
import { CardGrid } from "@/components/card-grid/card-grid";
import type { BookWithProgress } from "../types/library.types";
import { LibraryBig, TriangleAlert } from "lucide-react";

interface BookGridProps {
  isLoading: boolean;
  isSearch: boolean;
  error: string | null;
  books: BookWithProgress[];
  hideMoreByAuthor?: boolean;
  onRemoveFromCollection?: (bookId: string) => void;
  /** Overrides the default "Your library is empty" copy — used by the
   * collection detail screen ("This shelf is empty"). Only shown when
   * there's no search/filter active, same as the default copy. */
  emptyTitle?: string;
  emptyDescription?: string;
}

export const BookGrid: FC<BookGridProps> = memo(function BookGrid({
  isLoading,
  isSearch,
  error,
  books,
  hideMoreByAuthor,
  onRemoveFromCollection,
  emptyTitle = "Your library is empty",
  emptyDescription = "Tap + to import your first book.",
}) {
  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center py-24 gap-3 text-center"
      >
        <TriangleAlert
          size={48}
          strokeWidth={1.5}
          className="text-destructive/60"
        />
        <p className="text-ui uppercase tracking-[0.15em] text-destructive font-heading">
          Couldn't load your library
        </p>
        <p className="text-ui-sm text-muted-foreground opacity-60">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center py-24 text-ui text-muted-foreground"
      >
        Loading your library…
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center py-24 gap-3 text-center"
      >
        <LibraryBig
          size={48}
          strokeWidth={1.5}
          className="text-muted-foreground/30"
        />
        <p className="text-ui uppercase tracking-[0.15em] text-muted-foreground font-heading">
          {isSearch ? "No books found" : emptyTitle}
        </p>
        {!isSearch && (
          <p className="text-ui-sm text-muted-foreground opacity-60">
            {emptyDescription}
          </p>
        )}
      </div>
    );
  }

  return (
    <CardGrid
      items={books}
      getKey={(book) => book.id}
      renderItem={(book) => (
        <BookCard
          {...book}
          hideMoreByAuthor={hideMoreByAuthor}
          onRemoveFromCollection={onRemoveFromCollection}
        />
      )}
    />
  );
});
