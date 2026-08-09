import { findMatches } from "./search-index";
import { tokenizeChapterHtml } from "./tokenize";

export interface ChapterMatch {
  bookId: string;
  chapter: number;
  matchedWords: string[];
}

/**
 * Ranks chapters by how many distinct query words they matched (desc), then
 * by chapter index (asc) as a tiebreak. The index stores one row per unique
 * word per chapter (see search-service.ts), not raw occurrence counts, so an
 * occurrence-frequency ranking isn't available without a schema change —
 * this is the simplest ranking the current data actually supports.
 */
function rankMatches(
  matchedWordsByChapter: Map<
    string,
    { bookId: string; chapter: number; words: Set<string> }
  >,
): ChapterMatch[] {
  return [...matchedWordsByChapter.values()]
    .map(({ bookId, chapter, words }) => ({
      bookId,
      chapter,
      matchedWords: [...words],
    }))
    .sort(
      (a, b) =>
        b.matchedWords.length - a.matchedWords.length || a.chapter - b.chapter,
    );
}

/** Content search across chapters, optionally scoped to one book. */
export async function findChapterMatches(
  query: string,
  bookId?: string,
): Promise<ChapterMatch[]> {
  const words = tokenizeChapterHtml(query);
  if (words.length === 0) return [];

  const perWordMatches = await Promise.all(
    words.map((word) => findMatches(word, bookId)),
  );

  const matchedWordsByChapter = new Map<
    string,
    { bookId: string; chapter: number; words: Set<string> }
  >();

  perWordMatches.forEach((matches, i) => {
    const word = words[i];
    for (const match of matches) {
      const key = `${match.bookId}:${match.chapter}`;
      const entry = matchedWordsByChapter.get(key) ?? {
        bookId: match.bookId,
        chapter: match.chapter,
        words: new Set<string>(),
      };
      entry.words.add(word);
      matchedWordsByChapter.set(key, entry);
    }
  });

  return rankMatches(matchedWordsByChapter);
}
