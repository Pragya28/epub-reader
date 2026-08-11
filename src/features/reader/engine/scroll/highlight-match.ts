/**
 * Finds the first case-insensitive occurrence of `word` in `sectionEl`'s
 * text and wraps it in a <mark class="search-highlight">, splitting the
 * containing text node around it. Single-word only, matching the search
 * engine's own single-word snippet extraction (services/search/snippet.ts) —
 * no multi-word phrase highlighting.
 */
export function highlightWordInSection(
  sectionEl: HTMLElement,
  word: string,
): HTMLElement | null {
  const lowerWord = word.toLowerCase();
  const walker = document.createTreeWalker(sectionEl, NodeFilter.SHOW_TEXT);

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent ?? "";
    const index = text.toLowerCase().indexOf(lowerWord);
    if (index === -1) continue;

    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + word.length);

    const mark = document.createElement("mark");
    mark.className = "search-highlight";
    range.surroundContents(mark);

    return mark;
  }

  return null;
}
