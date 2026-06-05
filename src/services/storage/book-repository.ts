import { db } from "./db";
import type { StoredBook } from "./storage-types";

export async function saveBookMetadata(book: StoredBook) {
  await db.books.put(book);
}

export async function saveBookFile(bookId: string, file: Blob) {
  await db.bookFiles.put({
    bookId,
    file,
  });
}

export async function getAllBooks() {
  return db.books.orderBy("createdAt").reverse().toArray();
}

export async function getBook(bookId: string) {
  return db.books.get(bookId);
}

export async function getBookFile(bookId: string) {
  return db.bookFiles.get(bookId);
}

export async function getBookWithFile(bookId: string) {
  const [book, bookFile] = await Promise.all([
    db.books.get(bookId),
    db.bookFiles.get(bookId),
  ]);

  if (!book || !bookFile) {
    return null;
  }

  return {
    book,
    file: bookFile.file,
  };
}
