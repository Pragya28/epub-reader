interface SearchableBook {
  title: string;
  author?: string;
  description?: string | null;
}

/** Case-insensitive match across title, author and description. */
export function filterBooksByQuery<T extends SearchableBook>(
  books: T[],
  query: string,
): T[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) return books;

  return books.filter((book) =>
    [book.title, book.author, book.description].some((field) =>
      field?.toLowerCase().includes(normalized),
    ),
  );
}
