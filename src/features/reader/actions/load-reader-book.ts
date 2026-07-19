import { EpubParser } from "@/services/epub/epub-parser";
import { getBookWithFile } from "@/services/storage/book-repository";
import { readerStore } from "../store/reader-store";

export async function loadReaderBook(bookId: string) {
  const store = readerStore.getState();
  const parser = new EpubParser();

  try {
    store.setLoading(true);
    store.setError(null);

    const readerDocument = await getBookWithFile(bookId);

    if (!readerDocument) {
      throw new Error("Book not found");
    }

    const parsedBook = await parser.parseBook(readerDocument.file);

    store.setReaderDocument(readerDocument);
    store.setParsedBook(parsedBook);
  } catch (error) {
    store.setError(
      error instanceof Error ? error.message : "Failed to load book",
    );

    throw error;
  } finally {
    store.setLoading(false);
  }
}
