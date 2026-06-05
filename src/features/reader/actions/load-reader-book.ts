import { getBookWithFile } from "@/services/storage/book-repository";

export async function loadReaderBook(bookId: string) {
  const result = await getBookWithFile(bookId);

  if (!result) {
    throw new Error("Book not found");
  }

  return result;
}
