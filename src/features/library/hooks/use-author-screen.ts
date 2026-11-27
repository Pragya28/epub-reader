import { useEffect } from "react";
import { useParams } from "react-router-dom";

import { libraryStore } from "../store/library-store";
import { authorFilterStore } from "../store/filter-store";
import { loadLibrary } from "../actions/load-library";
import { enrichBookWithProgress } from "../utils/derive-book-status";
import {
  filterBooksByAuthor,
  filterBooksByCriteria,
} from "../utils/filter-books";
import { countBooks } from "../utils/count-books";
import { sortBooks } from "../utils/sort-books";
import { useLibraryFilters } from "./use-library-filters";

/** Books by a single author, reached from a book card's "More by Author" action. */
export function useAuthorScreen() {
  const { author: encodedAuthor } = useParams<{ author: string }>();
  const author = decodeURIComponent(encodedAuthor ?? "");
  const { books, isLoading, error } = libraryStore();

  useEffect(() => {
    void loadLibrary();
  }, []);

  const enriched = books.map(enrichBookWithProgress);
  const { sortBy, filters, ...libraryFilters } = useLibraryFilters(
    enriched,
    authorFilterStore,
  );
  const byAuthor = filterBooksByAuthor(enriched, author);
  const authorBooks = filterBooksByCriteria(
    sortBooks(byAuthor, sortBy),
    filters,
  );

  return {
    author,
    isLoading,
    error,
    books: authorBooks,
    counts: countBooks(byAuthor),
    sortBy,
    filters,
    ...libraryFilters,
  };
}
