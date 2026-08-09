import { findChapterMatches } from "@/services/search/search-content";
import type { ChapterMatch } from "@/services/search/search-content";
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
 */
export async function searchLibrary(
  books: BookWithProgress[],
  query: string,
): Promise<LibrarySearchResults> {
  const metadataMatches = filterBooksByQuery(books, query);
  const contentMatches = await findChapterMatches(query);

  return { metadataMatches, contentMatches };
}
