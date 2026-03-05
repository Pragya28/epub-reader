export const detectVisibleChapter = (
  sections: HTMLElement[],
  currentVisible: number,
): number => {
  let active = currentVisible;
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

  return active;
};
