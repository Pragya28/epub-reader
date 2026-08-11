import { useEffect } from "react";
import { useParams } from "react-router-dom";

import { libraryStore } from "../store/library-store";
import { authorFilterStore } from "../store/library-filter-store";
import { loadLibrary } from "../actions/load-library";
import { enrichBookWithProgress } from "../utils/derive-book-status";
import {
  filterBooksByAuthor,
  filterBooksByCriteria,
} from "../utils/filter-books";
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
  const authorBooks = filterBooksByCriteria(
    sortBooks(filterBooksByAuthor(enriched, author), sortBy),
    filters,
  );

  return {
    author,
    isLoading,
    error,
    books: authorBooks,
    sortBy,
    filters,
    ...libraryFilters,
  };
}
