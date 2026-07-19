import type { ParsedChapter } from "@/services/epub/epub-types";
import { unmountChapterSection } from "../renderer/iframe-renderer";
import { getChapterSections } from "../scroll/get-chapter-sections";

export const WINDOW_RADIUS = 2;
export const MAX_WINDOW_SIZE = WINDOW_RADIUS * 2 + 1;

interface MaintainChapterWindowProps {
  iframeDoc: Document;
  win: Window;
  activeIndex: number;
  chapters: ParsedChapter[];
  loadedIndices: ReadonlySet<number>;
  onUnload: (index: number) => void;
}

export function maintainChapterWindow({
  iframeDoc,
  win,
  activeIndex,
  chapters,
  loadedIndices,
  onUnload,
}: MaintainChapterWindowProps): void {
  const sections = getChapterSections(iframeDoc);

  if (sections.length <= MAX_WINDOW_SIZE) return;

  const anchor = iframeDoc.querySelector(
    `section[data-chapter="${activeIndex}"]`,
  ) as HTMLElement | null;

  if (!anchor) return;

  const anchorTopBefore = anchor.getBoundingClientRect().top;

  loadedIndices.forEach((index) => {
    if (
      index !== activeIndex &&
      Math.abs(index - activeIndex) > WINDOW_RADIUS
    ) {
      unmountChapterSection(iframeDoc, index);
      revokeChapterAssets(chapters[index]);
      onUnload(index);
    }
  });

  const delta = anchor.getBoundingClientRect().top - anchorTopBefore;

  if (delta !== 0) {
    win.scrollBy(0, delta);
  }
}

function revokeChapterAssets(chapter: ParsedChapter | undefined): void {
  if (!chapter) return;

  chapter.assetMap.forEach((blobUrl) => {
    URL.revokeObjectURL(blobUrl);
  });
}
