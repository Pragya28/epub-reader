import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ROUTES } from "@/utils/routes";
import type { BookWithProgress } from "../types/library.types";
import {
  markBookFinished,
  markBookUnread,
  startBookAtBeginning,
} from "../actions/mark-book-status";
import { deleteBook } from "../actions/delete-book";
import { libraryStore } from "../store/library-store";

export type BookCardMenuEntry =
  | { type: "separator"; id: string }
  | {
      type: "item";
      id: string;
      label: string;
      onClick: () => void;
      variant?: "destructive";
    };

/** Dropdown actions and derived status text behind a single BookCard. */
export function useBookCard(book: BookWithProgress) {
  const { id, author, isFinished, isReading, progress } = book;
  const navigate = useNavigate();
  const booksByAuthorCount = libraryStore((state) =>
    author ? state.books.filter((b) => b.author === author).length : 0,
  );
  const [aboutOpen, setAboutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const statusText = isFinished
    ? "Finished"
    : isReading && progress !== undefined
      ? `${progress}% read`
      : null;

  const hasMoreByAuthor = booksByAuthorCount > 1;

  const openInReader = () => navigate(ROUTES.READER.replace(":bookId", id));
  const markFinished = () => void markBookFinished(id);
  const markUnread = () => void markBookUnread(id);
  const startAtBeginning = () => void startBookAtBeginning(id);
  const openAboutSheet = () => setAboutOpen(true);
  const openDeleteConfirm = () => setDeleteOpen(true);
  const confirmDelete = () => void deleteBook(id);
  const openMoreByAuthor = () =>
    navigate(
      ROUTES.LIBRARY_AUTHOR.replace(":author", encodeURIComponent(author!)),
    );

  const menuItems: BookCardMenuEntry[] = [
    { type: "item", id: "open", label: "Open", onClick: openInReader },
    { type: "separator", id: "sep-1" },
    ...(!isFinished
      ? ([
          {
            type: "item",
            id: "mark-finished",
            label: "Mark as Finished",
            onClick: markFinished,
          },
        ] as const)
      : []),
    ...(isFinished || isReading
      ? ([
          {
            type: "item",
            id: "mark-unread",
            label: "Mark as Unread",
            onClick: markUnread,
          },
        ] as const)
      : []),
    ...(isReading || isFinished
      ? ([
          {
            type: "item",
            id: "start-at-beginning",
            label: "Start at Beginning",
            onClick: startAtBeginning,
          },
        ] as const)
      : []),
    { type: "separator", id: "sep-2" },
    {
      type: "item",
      id: "about-book",
      label: "About Book",
      onClick: openAboutSheet,
    },
    ...(hasMoreByAuthor
      ? ([
          {
            type: "item",
            id: "more-by-author",
            label: "More by Author",
            onClick: openMoreByAuthor,
          },
        ] as const)
      : []),
    { type: "separator", id: "sep-3" },
    {
      type: "item",
      id: "delete",
      label: "Delete",
      onClick: openDeleteConfirm,
      variant: "destructive",
    },
  ];

  return {
    statusText,
    aboutOpen,
    setAboutOpen,
    deleteOpen,
    setDeleteOpen,
    confirmDelete,
    hasMoreByAuthor,
    openMoreByAuthor,
    menuItems,
  };
}
