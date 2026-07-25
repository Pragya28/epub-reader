import type { FC } from "react";
import { BookCard } from "./book-card/book-card";
import type { BookWithProgress } from "../types/library.types";
import { LibraryBig } from "lucide-react";

interface BookGridProps {
  isLoading: boolean;
  isSearch: boolean;
  books: BookWithProgress[];
}

export const BookGrid: FC<BookGridProps> = ({ isLoading, isSearch, books }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        Loading your library…
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <LibraryBig
          size={48}
          strokeWidth={1.5}
          className="text-muted-foreground/30"
        />
        <p className="text-sm uppercase tracking-[0.15em] text-muted-foreground font-heading">
          {isSearch ? "No books found" : "Your library is empty"}
        </p>
        {!isSearch && (
          <p className="text-xs text-muted-foreground opacity-60">
            Tap + to import your first book.
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="grid gap-x-4 gap-y-7"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
    >
      {books.map((book) => (
        <BookCard key={book.id} {...book} />
      ))}
    </div>
  );
};
