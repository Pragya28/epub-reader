import { findChapterMatches } from "@/services/search/search-content";
import type { ChapterMatch } from "@/services/search/search-content";
import { ensureIndexesForBooks } from "@/services/search/search-service";
import { filterBooksByQuery } from "@/services/search/search-metadata";
import type { BookWithProgress } from "../types/library.types";

export interface LibrarySearchResults {
  /** Book-level metadata matches (title/author/description). */
  metadataMatches: BookWithProgress[];
  /** Chapter-level content matches, ranked, distinct from metadata matches. */
  contentMatches: ChapterMatch[];
}

/**
 * Combines the existing metadata search with the new content search as two
 * distinct results modes (see tasks/SPRINT-06-TASKS.md Day 3) rather than
 * merging them into one list — a metadata hit is a book, a content hit is a
 * chapter, and collapsing them would lose the chapter jump target.
 *
 * Backfills any book missing a search index (lazy migration for books
 * imported before Sprint 6 — see tasks/SPRINT-06-TASKS.md Day 5) before
 * running content search, so older libraries become searchable on first use.
 */
export async function searchLibrary(
  books: BookWithProgress[],
  query: string,
): Promise<LibrarySearchResults> {
  await ensureIndexesForBooks(books.map((book) => book.id));

  const metadataMatches = filterBooksByQuery(books, query);
  const contentMatches = await findChapterMatches(query);

  return { metadataMatches, contentMatches };
}
