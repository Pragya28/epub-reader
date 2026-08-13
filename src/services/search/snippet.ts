import { EpubParser } from "@/services/epub/epub-parser";
import { toPlainText } from "./html-text";

const SNIPPET_CONTEXT_CHARS = 60;

/**
 * Plain-text excerpt around the first occurrence of `word`. `html` may be
 * raw chapter markup or already-plain text (e.g. from the chapter-text
 * cache) — toPlainText is a no-op on text with no tags left to strip.
 */
export function extractSnippet(html: string, word: string): string {
  const text = toPlainText(html);

  const index = text.toLowerCase().indexOf(word.toLowerCase());
  if (index === -1) return text.slice(0, SNIPPET_CONTEXT_CHARS * 2);

  const start = Math.max(0, index - SNIPPET_CONTEXT_CHARS);
  const end = Math.min(
    text.length,
    index + word.length + SNIPPET_CONTEXT_CHARS,
  );

  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";

  return prefix + text.slice(start, end) + suffix;
}

/** Loads one chapter from the book file and extracts a snippet around `word`. */
export async function getChapterSnippet(
  file: Blob,
  chapterIndex: number,
  word: string,
): Promise<string> {
  const parser = new EpubParser();
  const parsedBook = await parser.parseBook(file);
  const chapter = await parsedBook.loadChapter(chapterIndex);

  return extractSnippet(chapter.content, word);
}
