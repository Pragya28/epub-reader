import type { ParsedChapter } from "@/services/epub/epub-types";
import { renderIframe } from "./iframe-renderer";

export function renderChapter(
  iframe: HTMLIFrameElement,
  chapter: ParsedChapter,
) {
  renderIframe(iframe, chapter.content, chapter.stylesheets);
}
