import type { FC } from "react";
import { BookCard } from "./book-card/book-card";
import type { BookWithProgress } from "../types/library.types";

interface BookGridProps {
  isLoading: boolean;
  isSearch: boolean;
  books: BookWithProgress[];
  error?: string | null;
}

export const BookGrid: FC<BookGridProps> = ({
  isLoading,
  isSearch,
  books,
  error,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-secondary">
        Loading your library…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <span className="text-9xl opacity-30">⚠</span>
        <p className="text-s uppercase tracking-[0.15em] text-secondary body-display">
          Failed to load library
        </p>
        <p className="text-xs text-secondary opacity-60 max-w-55">{error}</p>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <span className="text-9xl opacity-20">📚</span>
        <p className="text-s uppercase tracking-[0.15em] text-secondary body-display">
          {isSearch ? "No books found" : "Your library is empty"}
        </p>
        {!isSearch && (
          <p className="text-xs text-secondary opacity-60">
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
      {books.map((book, i) => (
        <BookCard key={book.id} book={book} index={i} />
      ))}
    </div>
  );
};
