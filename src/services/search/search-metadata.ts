interface SearchableBook {
  title: string;
  author?: string;
  description?: string | null;
}

/**
 * Case-insensitive match across title, author and description. Every
 * whitespace-separated term must appear somewhere in the combined fields, so
 * "tolkien hobbit" matches a book titled "The Hobbit" by "J.R.R. Tolkien" the
 * same way the tokenized content search does — rather than only matching the
 * query as one contiguous substring of a single field.
 */
export function filterBooksByQuery<T extends SearchableBook>(
  books: T[],
  query: string,
): T[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (terms.length === 0) return books;

  return books.filter((book) => {
    const haystack = [book.title, book.author, book.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
