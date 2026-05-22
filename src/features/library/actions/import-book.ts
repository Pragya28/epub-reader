import { EpubServiceImpl } from "@/services/epub/epub.service";
import { OpfParser } from "@/services/epub/opf-parser";
import {
  saveBookFile,
  saveBookMetadata,
} from "@/services/storage/book-repository";
import { createBookId } from "@/utils/create-book-id";
import { hashFile } from "@/utils/hash-file";
import { useLibraryStore } from "../store/library-store";
import type { StoredBook } from "@/services/storage/storage-types";

export async function importBook(file: File) {
  const store = useLibraryStore.getState();

  try {
    store.setLoading(true);
    store.setError(null);

    const epubService = new EpubServiceImpl();
    const opfParser = new OpfParser();

    // 1. Extract OPF
    const extraction = await epubService.extractOpf(file);

    // 2. Parse OPF
    const parsedBook = opfParser.parse(extraction.opfXml);

    // 3. Generate app ID
    const bookId = createBookId();

    // 4. Hash file for duplicate detection
    const fileHash = await hashFile(file);

    // 5. Check duplicates
    const existingBook = store.books.find((book) => book.fileHash === fileHash);

    if (existingBook) {
      throw new Error("Book already imported");
    }

    const book: StoredBook = {
      id: bookId,
      title: parsedBook.metadata.title,
      author: parsedBook.metadata.author,
      language: parsedBook.metadata.language,
      createdAt: Date.now(),
      fileHash,
    };

    // 6. Persist metadata
    await saveBookMetadata(book);

    // 7. Persist original EPUB
    await saveBookFile(bookId, file);

    // 8. Update store reactively
    store.addBook(book);

    return {
      id: bookId,
      metadata: parsedBook.metadata,
    };
  } catch (error) {
    store.setError(
      error instanceof Error ? error.message : "Failed to import book",
    );

    throw error;
  } finally {
    store.setLoading(false);
  }
}
