import { EpubParser } from "@/services/epub/epub-parser";
import { extractSnippet } from "@/services/search/snippet";
import {
  getBookCoverUrl,
  getBookWithFile,
} from "@/services/storage/book-repository";
import { flattenToc } from "@/features/reader/utils/flatten-toc";
import type { ChapterMatch } from "@/services/search/search-content";

export interface ContentMatchDisplay extends ChapterMatch {
  bookTitle: string;
  bookAuthor: string;
  coverUrl: string | undefined;
  chapterLabel: string;
  snippet: string;
}

async function loadBookOnce(bookId: string) {
  const readerDoc = await getBookWithFile(bookId);
  if (!readerDoc) return null;

  const [parsedBook, coverUrl] = await Promise.all([
    new EpubParser().parseBook(readerDoc.file),
    getBookCoverUrl(bookId),
  ]);

  return {
    book: readerDoc.book,
    parsedBook,
    coverUrl,
    // Flattened once per book rather than once per match.
    toc: flattenToc(parsedBook.toc, 0),
  };
}

export type LoadedBook = Awaited<ReturnType<typeof loadBookOnce>>;

/** Cache of parsed books, owned by the caller so it can outlive one call. */
export type BookCache = Map<string, Promise<LoadedBook>>;

/**
 * Builds display rows for content matches, parsing each book exactly **once**.
 *
 * This used to run per match, so N results in one book meant N fetches and N
 * full JSZip unzips of the same EPUB — measured at ~94ms per result against a
 * real 40-chapter book, i.e. ~3.7s for 39 matches, while the index query
 * itself was ~14ms. Parsing was effectively the entire cost of a search.
 *
 * `books` is passed in rather than created here so that paging to the next
 * batch of rows reuses the already-unzipped EPUB instead of re-parsing it.
 */
export async function loadSearchResultDisplays(
  matches: ChapterMatch[],
  books: BookCache,
): Promise<ContentMatchDisplay[]> {
  const bookFor = (bookId: string) => {
    let pending = books.get(bookId);
    if (!pending) {
      pending = loadBookOnce(bookId);
      books.set(bookId, pending);
    }
    return pending;
  };

  const rows = await Promise.all(
    matches.map(async (match): Promise<ContentMatchDisplay | null> => {
      const loaded = await bookFor(match.bookId);
      if (!loaded) return null;

      const chapter = await loaded.parsedBook.loadChapter(match.chapter);
      const tocEntry = loaded.toc.find(
        ({ item }) => item.chapterIndex === match.chapter,
      );

      return {
        ...match,
        bookTitle: loaded.book.title,
        bookAuthor: loaded.book.author ?? "",
        coverUrl: loaded.coverUrl,
        chapterLabel: tocEntry?.item.label ?? "",
        snippet: extractSnippet(chapter.content, match.matchedWords[0]),
      };
    }),
  );

  return rows.filter((row): row is ContentMatchDisplay => row !== null);
}
