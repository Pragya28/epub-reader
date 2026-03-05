import React from "react";

interface UseScrollEngineProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  readingOrderRef: React.RefObject<string[]>;
  loadedChaptersRef: React.RefObject<Set<number>>;
  isLoadingChapterRef: React.RefObject<boolean>;
  isJumpingRef: React.RefObject<boolean>;
  visibleChapterRef: React.RefObject<number>;
  renderChapterRef: React.RefObject<(index: number) => Promise<void>>;
  setVisibleChapter: React.Dispatch<React.SetStateAction<number>>;
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
}: UseScrollEngineProps) {
  React.useEffect(() => {
    const iframeDoc = iframeRef.current?.contentDocument;
    const win = iframeRef.current?.contentWindow;
    if (!iframeDoc || !win) return;

    const detectVisibleChapter = (sections: Element[]) => {
      let active = visibleChapterRef.current;
      let closestDistance = Infinity;

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const index = Number(section.getAttribute("data-chapter"));
        const distance = Math.abs(rect.top);
        if (distance < closestDistance) {
          closestDistance = distance;
          active = index;
        }
      });

      if (active !== visibleChapterRef.current) {
        visibleChapterRef.current = active;
        setVisibleChapter(active);
      }

      return active;
    };

    const loadNextChapter = (lastIndex: number, viewport: number) => {
      const lastSection = iframeDoc.querySelector(
        `section[data-chapter="${lastIndex}"]`,
      ) as HTMLElement | null;
      if (!lastSection) return;

      const lastSectionBottom =
        lastSection.offsetTop + lastSection.offsetHeight;
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

    const handleScroll = () => {
      if (isLoadingChapterRef.current || isJumpingRef.current) return;

      const viewport = win.innerHeight;

      const sections = Array.from(
        iframeDoc.querySelectorAll("section[data-chapter]"),
      ).sort(
        (a, b) =>
          Number(a.getAttribute("data-chapter")) -
          Number(b.getAttribute("data-chapter")),
      );

      if (sections.length === 0) return;

      const active = detectVisibleChapter(sections);

      // Walk loadedChaptersRef to find the contiguous window around active.
      // Needed because TOC jumps can leave non-contiguous sections in the DOM.
      let firstIndex = active;
      while (loadedChaptersRef.current.has(firstIndex - 1)) firstIndex--;

      let lastIndex = active;
      while (loadedChaptersRef.current.has(lastIndex + 1)) lastIndex++;

      loadNextChapter(lastIndex, viewport);
      loadPreviousChapter(firstIndex);
    };

    win.addEventListener("scroll", handleScroll);
    return () => win.removeEventListener("scroll", handleScroll);

    // Intentionally empty deps: all volatile values are read via refs.
    // This effect mounts once and never re-registers.
  }, []);
}
