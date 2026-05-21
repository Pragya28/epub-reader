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
