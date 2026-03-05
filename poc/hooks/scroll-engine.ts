import React from "react";
import { getChapterSections } from "../utils/get-chapter-sections";
import { detectVisibleChapter } from "../utils/detect-visible-chapter";
import { maintainChapterWindow } from "../utils/maintain-chapter-window";
import { createChapterLoader } from "../utils/create-chapter-loader";

interface UseScrollEngineProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  readingOrderRef: React.RefObject<string[]>;
  loadedChaptersRef: React.RefObject<Set<number>>;
  isLoadingChapterRef: React.RefObject<boolean>;
  isJumpingRef: React.RefObject<boolean>;
  visibleChapterRef: React.RefObject<number>;
  renderChapterRef: React.RefObject<(index: number) => Promise<void>>;
  setVisibleChapter: React.Dispatch<React.SetStateAction<number>>;
  chapterBlobUrlsRef: React.RefObject<Map<number, string[]>>;
  readingOrderLength: number;
}

export function useScrollEngine({
  iframeRef,
  readingOrderRef,
  loadedChaptersRef,
  isLoadingChapterRef,
  isJumpingRef,
  visibleChapterRef,
  renderChapterRef,
  setVisibleChapter,
  chapterBlobUrlsRef,
  readingOrderLength,
}: UseScrollEngineProps) {
  React.useEffect(() => {
    const iframe = iframeRef.current;
    const iframeDoc = iframe?.contentDocument;
    const win = iframe?.contentWindow;

    if (!iframeDoc || !win) return;

    const { loadNextChapter, loadPreviousChapter } = createChapterLoader({
      iframeDoc,
      win,
      readingOrderRef,
      loadedChaptersRef,
      isLoadingChapterRef,
      renderChapterRef,
    });

    const handleScroll = () => {
      if (isJumpingRef.current) return;

      const sections = getChapterSections(iframeDoc);
      if (sections.length === 0) return;

      const viewport = win.innerHeight;

      const active = detectVisibleChapter(sections, visibleChapterRef.current);

      if (active !== visibleChapterRef.current) {
        visibleChapterRef.current = active;
        setVisibleChapter(active);
      }

      // determine contiguous chapter window
      let firstIndex = active;
      while (loadedChaptersRef.current.has(firstIndex - 1)) {
        firstIndex--;
      }

      let lastIndex = active;
      while (loadedChaptersRef.current.has(lastIndex + 1)) {
        lastIndex++;
      }

      loadNextChapter(lastIndex, viewport);
      loadPreviousChapter(firstIndex);

      if (!isLoadingChapterRef.current) {
        maintainChapterWindow({
          iframeDoc,
          win,
          active,
          sections,
          loadedChaptersRef,
          chapterBlobUrlsRef,
        });
      }
    };

    /**
     * Scroll throttling via requestAnimationFrame
     */
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;

      ticking = true;

      requestAnimationFrame(() => {
        handleScroll();
        ticking = false;
      });
    };

    /**
     * Wait until first chapter appears in iframe
     */
    let attempts = 0;

    const startEngine = () => {
      const sections = getChapterSections(iframeDoc);

      if (!iframeDoc.body || sections.length === 0) {
        if (attempts++ < 120) {
          requestAnimationFrame(startEngine);
        }
        return;
      }

      win.addEventListener("scroll", onScroll, { passive: true });

      // initial engine run
      handleScroll();
    };

    startEngine();

    return () => {
      win.removeEventListener("scroll", onScroll);
    };
  }, [readingOrderLength]);
}
