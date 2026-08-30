export function detectVisibleChapter(
  sections: HTMLElement[],
  currentVisible: number,
): number {
  // The active chapter is the section that currently covers the top of the
  // viewport — not the one whose top edge is merely nearest to it. Picking by
  // nearest edge flips to chapter N+1 the moment the reader scrolls past
  // chapter N's midpoint, while chapter N still fills the whole screen.
  let active = currentVisible;
  let covered = false;
  let nearestUpcoming = currentVisible;
  let nearestUpcomingTop = Infinity;

  sections.forEach((section) => {
    const raw = section.getAttribute("data-chapter");
    if (raw === null) return;
    const index = Number(raw);
    if (Number.isNaN(index)) return;

    const rect = section.getBoundingClientRect();

    if (rect.top <= 0 && rect.bottom > 0) {
      active = index;
      covered = true;
    } else if (rect.top >= 0 && rect.top < nearestUpcomingTop) {
      nearestUpcomingTop = rect.top;
      nearestUpcoming = index;
    }
  });

  return covered ? active : nearestUpcoming;
}
