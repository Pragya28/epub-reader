import { EpubParser } from "@/services/epub/epub-parser";
import { getBookWithFile } from "@/services/storage/book-repository";
import { readerStore } from "../store/reader-store";

export async function loadReaderBook(
  bookId: string,
  jumpChapterIndex?: number,
) {
  const store = readerStore.getState();
  const parser = new EpubParser();

  try {
    store.setLoading(true);
    store.setError(null);

    const readerDocument = await getBookWithFile(bookId);

    if (!readerDocument) {
      throw new Error("Book not found");
    }

    // Set immediately (before the slow parse) so the loading screen can show
    // the book's title/cover instead of a bare spinner.
    store.setReaderDocument(readerDocument);

    const parsedBook = await parser.parseBook(readerDocument.file);

    store.setParsedBook(parsedBook);

    const savedProgress = readerDocument.book.progress;
    const totalChapters = parsedBook.chapters.length;

    if (
      jumpChapterIndex !== undefined &&
      jumpChapterIndex >= 0 &&
      jumpChapterIndex < totalChapters
    ) {
      // A search-result jump overrides saved progress — the reader should
      // open at the chapter the user clicked from search, not wherever they
      // last left off. useReaderEngine's searchJump branch handles scrolling
      // and highlighting once that chapter's section mounts.
      store.setCurrentChapterIndex(jumpChapterIndex);
    } else if (
      savedProgress &&
      savedProgress.chapterIndex >= 0 &&
      savedProgress.chapterIndex < totalChapters
    ) {
      // Seeds currentChapterIndex before the engine mounts, so the initial
      // chapter-window load plan centers on the last-read chapter instead
      // of chapter 0. The exact in-chapter scroll offset is restored
      // separately by useReaderEngine once that chapter's section exists.
      store.setCurrentChapterIndex(savedProgress.chapterIndex);
      // Seed the progress bar with the persisted percent so it shows the
      // correct value immediately on open, before the first scroll event.
      store.setProgressPercent(savedProgress.percent);
    } else if (
      parsedBook.startChapterIndex !== undefined &&
      parsedBook.startChapterIndex >= 0 &&
      parsedBook.startChapterIndex < totalChapters
    ) {
      // First-ever open with no saved progress: skip cover/title-page front
      // matter and open at the book's declared start of content.
      store.setCurrentChapterIndex(parsedBook.startChapterIndex);
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
