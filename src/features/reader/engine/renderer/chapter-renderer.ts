import type { ParsedChapter } from "@/services/epub/epub-types";
import {
  initializeReaderDocument,
  mountChapterSection,
  unmountChapterSection,
} from "./iframe-renderer";

export function initializeChapterDocument(
  iframe: HTMLIFrameElement,
  chapters: ParsedChapter[],
  bookId?: string,
): void {
  const uniqueStylesheets = [
    ...new Set(chapters.flatMap((chapter) => chapter.stylesheets)),
  ];
  initializeReaderDocument(iframe, uniqueStylesheets, bookId);
}

export function mountChapter(
  iframeDoc: Document,
  chapter: ParsedChapter,
  index: number,
): void {
  mountChapterSection(iframeDoc, chapter.content, index);
}

export function mountChapterFallback(iframeDoc: Document, index: number): void {
  mountChapterSection(
    iframeDoc,
    `<p class="chapter-mount-error">This chapter couldn't be displayed.</p>`,
    index,
  );
}

export function unmountChapter(iframeDoc: Document, index: number): void {
  unmountChapterSection(iframeDoc, index);
}
