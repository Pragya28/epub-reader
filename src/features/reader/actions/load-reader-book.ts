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

    const savedProgress = readerDocument.book.progress;
    const totalChapters = parsedBook.chapters.length;

    if (
      savedProgress &&
      savedProgress.chapterIndex >= 0 &&
      savedProgress.chapterIndex < totalChapters
    ) {
      // Seeds currentChapterIndex before the engine mounts, so the initial
      // chapter-window load plan centers on the last-read chapter instead
      // of chapter 0. The exact in-chapter scroll offset is restored
      // separately by useReaderEngine once that chapter's section exists.
      store.setCurrentChapterIndex(savedProgress.chapterIndex);
    }
  } catch (error) {
    store.setError(
      error instanceof Error ? error.message : "Failed to load book",
    );

    throw error;
  } finally {
    store.setLoading(false);
  }
}
