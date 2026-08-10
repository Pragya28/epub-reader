import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import { libraryStore } from "../store/library-store";
import { libraryFilterStore } from "../store/library-filter-store";
import { loadLibrary } from "../actions/load-library";
import { enrichBookWithProgress } from "../utils/derive-book-status";
import {
  filterBooksByAuthor,
  filterBooksByCriteria,
  hasActiveFilters,
} from "../utils/filter-books";
import { sortBooks } from "../utils/sort-books";

/** Books by a single author, reached from a book card's "More by Author" action. */
export function useAuthorScreen() {
  const { author: encodedAuthor } = useParams<{ author: string }>();
  const author = decodeURIComponent(encodedAuthor ?? "");
  const { books, isLoading, error } = libraryStore();
  const { sortBy, filters, setSortBy, setFilters, resetFilters } =
    libraryFilterStore(
      useShallow((state) => ({
        sortBy: state.sortBy,
        filters: state.filters,
        setSortBy: state.setSortBy,
        setFilters: state.setFilters,
        resetFilters: state.resetFilters,
      })),
    );
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    void loadLibrary();
  }, []);

  const enriched = books.map(enrichBookWithProgress);
  const authorBooks = filterBooksByCriteria(
    sortBooks(filterBooksByAuthor(enriched, author), sortBy),
    filters,
  );
  const languages = Array.from(
    new Set(enriched.map((book) => book.language).filter(Boolean)),
  ) as string[];

  return {
    author,
    isLoading,
    error,
    books: authorBooks,
    isFiltering: hasActiveFilters(filters),
    filterOpen,
    setFilterOpen,
    sortBy,
    setSortBy,
    filters,
    setFilters,
    resetFilters,
    languages,
  };
}
