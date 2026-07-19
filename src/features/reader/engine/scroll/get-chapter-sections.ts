export function getChapterSections(iframeDoc: Document): HTMLElement[] {
  return Array.from(iframeDoc.querySelectorAll("section[data-chapter]")).sort(
    (a, b) =>
      Number(a.getAttribute("data-chapter")) -
      Number(b.getAttribute("data-chapter")),
  ) as HTMLElement[];
}
