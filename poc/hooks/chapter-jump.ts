import React from "react";

interface UseChapterJumpProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  loadedChaptersRef: React.RefObject<Set<number>>;
  isJumpingRef: React.RefObject<boolean>;
  visibleChapterRef: React.RefObject<number>;
  renderChapter: (index: number) => Promise<void>;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  setVisibleChapter: React.Dispatch<React.SetStateAction<number>>;
}

export function useChapterJump({
  iframeRef,
  loadedChaptersRef,
  isJumpingRef,
  visibleChapterRef,
  renderChapter,
  setCurrentIndex,
  setVisibleChapter,
}: UseChapterJumpProps) {
  const jumpToChapter = (index: number) => {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc) return;

    // Lock scroll engine for the duration of the jump
    isJumpingRef.current = true;

    // Clear DOM so only the target chapter is in view — prevents scroll
    // engine from seeing stale non-contiguous sections during the jump.
    iframeDoc.body.replaceChildren();
    loadedChaptersRef.current.clear();

    renderChapter(index)
      .then(() => {
        const section = iframeDoc.querySelector(
          `section[data-chapter="${index}"]`,
        );
        section?.scrollIntoView({ behavior: "auto" });

        visibleChapterRef.current = index;
        setVisibleChapter(index);
      })
      .finally(() => {
        // Brief delay lets the iframe settle before re-enabling scroll engine
        setTimeout(() => {
          isJumpingRef.current = false;
        }, 150);
      });

    setCurrentIndex(index);
  };

  return { jumpToChapter };
}
