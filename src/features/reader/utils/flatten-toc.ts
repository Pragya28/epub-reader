import type { TocItem } from "@/services/epub/epub-types";

export function flattenToc(
  items: TocItem[],
  depth: number,
): { item: TocItem; depth: number }[] {
  const result: { item: TocItem; depth: number }[] = [];
  for (const item of items) {
    result.push({ item, depth });
    if (item.children.length > 0) {
      result.push(...flattenToc(item.children, depth + 1));
    }
  }
  return result;
}
