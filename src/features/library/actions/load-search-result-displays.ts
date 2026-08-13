import { EpubParser } from "@/services/epub/epub-parser";
import { extractSnippet } from "@/services/search/snippet";
import { getChapterText } from "@/services/search/chapter-text";
import {
  getBook,
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

interface BookMeta {
  title: string;
  author: string;
  coverUrl: string | undefined;
}

async function loadBookMetaOnce(bookId: string): Promise<BookMeta | null> {
  const [book, coverUrl] = await Promise.all([
    getBook(bookId),
    getBookCoverUrl(bookId),
  ]);
  if (!book) return null;
  return { title: book.title, author: book.author ?? "", coverUrl };
}

/** Title/author/cover only — no file fetch, no parsing. */
export type BookMetaCache = Map<string, Promise<BookMeta | null>>;

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

/**
 * Full-parse fallback, only reached on a chapter-text cache miss (a book
 * indexed before Sprint 6B, or one whose text cache write failed).
 */
export type BookCache = Map<string, Promise<LoadedBook>>;

function memoized<K, V>(
  map: Map<K, Promise<V>>,
  key: K,
  load: () => Promise<V>,
) {
  let pending = map.get(key);
  if (!pending) {
    pending = load();
    map.set(key, pending);
  }
  return pending;
}

/**
 * Builds display rows for content matches, without re-parsing the EPUB when
 * it can be avoided.
 *
 * Each chapter's plain text + TOC label is cached at index-build time
 * (search-service.ts) — the common case here is a Dexie read of the cache,
 * no file fetch and no JSZip unzip. A cache miss falls back to parsing the
 * whole book, exactly as this function worked before the cache existed;
 * `books` and `metaCache` are owned by the caller so paging through more
 * rows, or hitting several matches in the same book, never repeats work.
 *
 * This used to run per match unconditionally, so N results in one book
 * meant N fetches and N full JSZip unzips of the same EPUB — measured at
 * ~94ms per result against a real 40-chapter book, i.e. ~3.7s for 39
 * matches, while the index query itself was ~14ms.
 */
export async function loadSearchResultDisplays(
  matches: ChapterMatch[],
  books: BookCache,
  metaCache: BookMetaCache,
): Promise<ContentMatchDisplay[]> {
  const rows = await Promise.all(
    matches.map(async (match): Promise<ContentMatchDisplay | null> => {
      const cached = await getChapterText(match.bookId, match.chapter);

      if (cached) {
        const meta = await memoized(metaCache, match.bookId, () =>
          loadBookMetaOnce(match.bookId),
        );
        if (!meta) return null;

        return {
          ...match,
          bookTitle: meta.title,
          bookAuthor: meta.author,
          coverUrl: meta.coverUrl,
          chapterLabel: cached.label,
          snippet: extractSnippet(cached.text, match.matchedWords[0]),
        };
      }

      const loaded = await memoized(books, match.bookId, () =>
        loadBookOnce(match.bookId),
      );
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
