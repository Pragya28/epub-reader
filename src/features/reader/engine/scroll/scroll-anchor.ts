/**
 * A lightweight, CFI-like element anchor for restoring reading position.
 *
 * scrollFraction alone (section-relative scroll %) degrades under anything
 * that reflows the chapter differently between sessions — a wider/narrower
 * viewport, a different font stack while a web font is still loading, a
 * user font-size preference change — since it targets a pixel offset, not
 * content. An element anchor instead records *which block the reader was
 * at* as a path of child indices from the chapter section down to that
 * element, and resolves back to whatever element is now at that path. It
 * only breaks if the chapter's actual DOM structure changed (extremely
 * unlikely — chapter content is static per book), not if its layout did.
 *
 * This is deliberately much simpler than a real EPUB CFI (no character-level
 * offsets, no range support) — just enough to survive reflow, with
 * scrollFraction kept as the fallback for saved progress that predates this
 * field or in the rare case the path fails to resolve.
 */

const ANCHOR_CANDIDATE_SELECTOR =
  "p, h1, h2, h3, h4, h5, h6, li, blockquote, td, pre, figcaption";

/**
 * Finds the first "content block" element that isn't yet fully scrolled
 * past the top of the viewport, and records its position as a path of
 * child indices from `section` down to that element.
 */
export function computeScrollAnchor(section: HTMLElement): number[] | null {
  const candidates = section.querySelectorAll(ANCHOR_CANDIDATE_SELECTOR);

  let target: Element | null = null;

  for (const candidate of candidates) {
    if (candidate.getBoundingClientRect().bottom > 0) {
      target = candidate;
      break;
    }
  }

  if (!target) return null;

  const path: number[] = [];
  let node: Element = target;

  while (node !== section) {
    const parent: Element | null = node.parentElement;
    if (!parent) return null;

    const index = Array.from(parent.children).indexOf(node);
    if (index === -1) return null;

    path.unshift(index);
    node = parent;
  }

  return path;
}

/** Resolves a path produced by computeScrollAnchor back to its element,
 * or null if the section's structure no longer matches it. */
export function resolveScrollAnchor(
  section: HTMLElement,
  path: number[],
): HTMLElement | null {
  let node: Element = section;

  for (const index of path) {
    const child = node.children[index];
    if (!child) return null;
    node = child;
  }

  return node === section ? null : (node as HTMLElement);
}
