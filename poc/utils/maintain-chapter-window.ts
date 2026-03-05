export const WINDOW_RADIUS = 2;
export const MAX_WINDOW_SIZE = WINDOW_RADIUS * 2 + 1;

interface MaintainChapterWindowProps {
  iframeDoc: Document;
  win: Window;
  active: number;
  sections: HTMLElement[];
  loadedChaptersRef: React.RefObject<Set<number>>;
  chapterBlobUrlsRef: React.RefObject<Map<number, string[]>>;
}

export const maintainChapterWindow = ({
  iframeDoc,
  win,
  active,
  sections,
  loadedChaptersRef,
  chapterBlobUrlsRef,
}: MaintainChapterWindowProps): void => {
  if (sections.length <= MAX_WINDOW_SIZE) return;

  const anchor = iframeDoc.querySelector(
    `section[data-chapter="${active}"]`,
  ) as HTMLElement | null;

  if (!anchor) return;

  // Snapshot anchor position before removal shifts the layout
  const anchorTopBefore = anchor.getBoundingClientRect().top;

  sections.forEach((section) => {
    const index = Number(section.getAttribute("data-chapter"));

    if (index !== active && Math.abs(index - active) > WINDOW_RADIUS) {
      section.remove();

      loadedChaptersRef.current.delete(index);

      // 🔹 revoke blob urls for this chapter
      const urls = chapterBlobUrlsRef.current.get(index);

      urls?.forEach((url) => URL.revokeObjectURL(url));

      chapterBlobUrlsRef.current.delete(index);
    }
  });

  // Restore scroll so the anchor stays visually in place
  const delta = anchor.getBoundingClientRect().top - anchorTopBefore;

  if (delta !== 0) {
    win.scrollBy(0, delta);
  }
};
