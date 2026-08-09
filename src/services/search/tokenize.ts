import { STOP_WORDS } from "@/constants/search-stop-words";

/** Strips HTML, lowercases, strips punctuation, drops stop words/empty tokens. */
export function tokenizeChapterHtml(html: string): string[] {
  const text = html.replace(/<[^>]*>/g, " ");

  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word));
}
