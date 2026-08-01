// ponytail: per-document cache so scroll-tick callers don't re-run
// querySelectorAll every frame; callers that mutate chapter sections
// (mount/unmount) must call invalidateChapterSections(iframeDoc).
const cache = new WeakMap<Document, HTMLElement[]>();

export function getChapterSections(iframeDoc: Document): HTMLElement[] {
  const cached = cache.get(iframeDoc);
  if (cached) return cached;

  const sections = Array.from(
    iframeDoc.querySelectorAll("section[data-chapter]"),
  ).sort(
    (a, b) =>
      Number(a.getAttribute("data-chapter")) -
      Number(b.getAttribute("data-chapter")),
  ) as HTMLElement[];

  cache.set(iframeDoc, sections);
  return sections;
}

export function invalidateChapterSections(iframeDoc: Document): void {
  cache.delete(iframeDoc);
}
