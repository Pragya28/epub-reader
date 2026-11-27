import type { BookWithProgress } from "../types/library.types";

export interface BookCounts {
  total: number;
  finished: number;
}

export function countBooks(books: BookWithProgress[]): BookCounts {
  return {
    total: books.length,
    finished: books.filter((book) => book.isFinished).length,
  };
}
