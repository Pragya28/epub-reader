import { EpubParser } from "@/services/epub/epub-parser";
import { saveImportedBook } from "@/services/storage/book-repository";
import { createBookId } from "@/shared/utils/create-book-id";
import { hashFile } from "@/shared/utils/hash";
import { libraryStore } from "../store/library-store";
import type { StoredBook } from "@/services/storage/storage-types";

export async function importBook(file: File) {
  const store = libraryStore.getState();
  const parser = new EpubParser();

  try {
    store.setLoading(true);
    store.setError(null);

    // 2. Parse book
    const parsed = await parser.parseLibraryBook(file);

    const { metadata, cover } = parsed;

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
      title: metadata.title,
      author: metadata.author,
      language: metadata.language,
      createdAt: Date.now(),
      fileHash,
    };

    // 6. Persist book
    await saveImportedBook({
      metadata: book,
      file,
      cover,
    });

    // 7. Update store reactively
    store.addBook(book);

    return {
      id: bookId,
      metadata: metadata,
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
