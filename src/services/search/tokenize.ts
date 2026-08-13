import { STOP_WORDS } from "@/constants/search-stop-words";
import { toPlainText } from "./html-text";

/** Strips HTML, lowercases, strips punctuation, drops stop words/empty tokens. */
export function tokenizeChapterHtml(html: string): string[] {
  return toPlainText(html)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word));
}
