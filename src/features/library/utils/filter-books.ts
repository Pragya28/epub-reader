import type { BookWithProgress } from "../types/library.types";

/** Case-insensitive match across title, author and description. */
export function filterBooksByQuery(
  books: BookWithProgress[],
  query: string,
): BookWithProgress[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) return books;

  return books.filter((book) =>
    [book.title, book.author, book.description].some((field) =>
      field?.toLowerCase().includes(normalized),
    ),
  );
}
