import React, { type ChangeEvent } from "react";
import { importBook } from "../actions/import-book";
import { getAllBooks } from "@/services/storage/book-repository";
import type { StoredBook } from "@/services/storage/storage-types";

interface ImportBookButtonProps {
  setBooks: React.Dispatch<React.SetStateAction<StoredBook[]>>;
}

export const ImportBookButton: React.FC<ImportBookButtonProps> = ({
  setBooks,
}) => {
  const onImport = async (
    e: ChangeEvent<HTMLInputElement, HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importBook(file);
    const updatedBooks = await getAllBooks();
    setBooks(updatedBooks);
  };
  return <input type="file" accept=".epub" onChange={onImport} />;
};
