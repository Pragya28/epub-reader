import React from "react";

interface UseChapterLoaderProps {
  iframeDoc: Document;
  win: Window;
  readingOrderRef: React.RefObject<string[]>;
  loadedChaptersRef: React.RefObject<Set<number>>;
  isLoadingChapterRef: React.RefObject<boolean>;
  renderChapterRef: React.RefObject<(index: number) => Promise<void>>;
}

interface ChapterLoaderReturn {
  loadNextChapter: (lastIndex: number, viewport: number) => void;
  loadPreviousChapter: (firstIndex: number) => void;
}

export const createChapterLoader = ({
  iframeDoc,
  win,
  readingOrderRef,
  loadedChaptersRef,
  isLoadingChapterRef,
  renderChapterRef,
}: UseChapterLoaderProps): ChapterLoaderReturn => {
  const loadNextChapter = (lastIndex: number, viewport: number) => {
    const lastSection = iframeDoc.querySelector(
      `section[data-chapter="${lastIndex}"]`,
    ) as HTMLElement | null;
    if (!lastSection) return;

    const lastSectionBottom = lastSection.offsetTop + lastSection.offsetHeight;
    if (win.scrollY + viewport <= lastSectionBottom - 300) return;

    const next = lastIndex + 1;
    if (next >= readingOrderRef.current.length) return;
    if (loadedChaptersRef.current.has(next)) return;

    isLoadingChapterRef.current = true;
    renderChapterRef.current(next).finally(() => {
      isLoadingChapterRef.current = false;
    });
  };

  const loadPreviousChapter = (firstIndex: number) => {
    const firstSection = iframeDoc.querySelector(
      `section[data-chapter="${firstIndex}"]`,
    ) as HTMLElement | null;
    if (!firstSection) return;

    if (win.scrollY >= firstSection.offsetTop + 300) return;

    const prev = firstIndex - 1;
    if (prev < 0) return;
    if (loadedChaptersRef.current.has(prev)) return;

    isLoadingChapterRef.current = true;

    const beforeHeight = iframeDoc.body.scrollHeight;
    const beforeScroll = win.scrollY;

    renderChapterRef
      .current(prev)
      .then(() => {
        const afterHeight = iframeDoc.body.scrollHeight;
        win.scrollTo(0, beforeScroll + (afterHeight - beforeHeight));
      })
      .finally(() => {
        isLoadingChapterRef.current = false;
      });
  };

  return { loadNextChapter, loadPreviousChapter };
};
