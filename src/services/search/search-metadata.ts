interface SearchableBook {
  title: string;
  author?: string;
  description?: string | null;
}

/**
 * Case-insensitive match across title, author and description. Every
 * whitespace-separated term must appear somewhere in the combined fields, so
 * "tolkien hobbit" matches a book titled "The Hobbit" by "J.R.R. Tolkien" —
 * rather than only matching the query as one contiguous substring of a
 * single field. Unlike content search, this doesn't drop stop words: it has
 * no token index to be limited by, and several real book titles are
 * themselves stop words (e.g. "It", "We"), so filtering them out would make
 * those titles unsearchable by their own name.
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
