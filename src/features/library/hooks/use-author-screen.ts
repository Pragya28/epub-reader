import { useEffect } from "react";
import { useParams } from "react-router-dom";

import { libraryStore } from "../store/library-store";
import { loadLibrary } from "../actions/load-library";
import { enrichBookWithProgress } from "../utils/derive-book-status";
import { filterBooksByAuthor } from "../utils/filter-books";
import { sortBooks } from "../utils/sort-books";

/** Books by a single author, reached from a book card's "More by Author" action. */
export function useAuthorScreen() {
  const { author: encodedAuthor } = useParams<{ author: string }>();
  const author = decodeURIComponent(encodedAuthor ?? "");
  const { books, isLoading, error } = libraryStore();

  useEffect(() => {
    void loadLibrary();
  }, []);

  const enriched = books.map(enrichBookWithProgress);
  const authorBooks = sortBooks(filterBooksByAuthor(enriched, author), "title");

  return { author, isLoading, error, books: authorBooks };
}
