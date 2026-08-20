import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "@/utils/routes";
import { isCollection } from "@/services/storage/groupings";
import {
  deleteCollection,
  removeBookFromCollection,
  renameCollection,
} from "../actions/collections";
import { collectionFilterStore } from "../store/filter-store";
import { filterBooksByCriteria } from "../utils/filter-books";
import { useGroupingBooks } from "./use-grouping-books";
import { useLibraryFilters } from "./use-library-filters";

/**
 * Books in a single user collection, reached from the Shelves tab. Unlike
 * the series screen, there's no per-instance hideFinished override — a
 * collection isn't assumed to be a small curated list the way a series is,
 * so it uses the same filter defaults as the main library.
 */
export function useCollectionDetailScreen() {
  const { groupingId } = useParams<{ groupingId: string }>();
  const navigate = useNavigate();
  const { grouping, orderedBooks, isLoading, reload } =
    useGroupingBooks(groupingId);

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    filterOpen,
    setFilterOpen,
    filters,
    setFilters,
    resetFilters,
    languages,
    isFiltering,
  } = useLibraryFilters(orderedBooks, collectionFilterStore);

  const visibleBooks = filterBooksByCriteria(orderedBooks, filters);

  const rename = async (name: string) => {
    if (!groupingId) return;
    await renameCollection(groupingId, name);
    reload();
  };

  const confirmDelete = async () => {
    if (!groupingId) return;
    await deleteCollection(groupingId);
    navigate(ROUTES.LIBRARY_SHELVES);
  };

  const removeBook = async (bookId: string) => {
    if (!groupingId) return;
    await removeBookFromCollection(groupingId, bookId);
    reload();
  };

  return {
    groupingName: grouping?.name ?? null,
    redirectToShelves:
      grouping === null || (grouping ? !isCollection(grouping) : false),
    isLoading,
    error: null,
    books: visibleBooks,
    isFiltering,
    filterOpen,
    setFilterOpen,
    filters,
    setFilters,
    resetFilters,
    languages,
    renameOpen,
    setRenameOpen,
    rename,
    deleteOpen,
    setDeleteOpen,
    confirmDelete,
    removeBook,
  };
}
