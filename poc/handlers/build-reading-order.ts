import type { ManifestItem } from "../interface";

export function buildReadingOrder(
  spine: string[],
  manifest: Record<string, ManifestItem>,
  basePath: string,
): string[] {
  return spine
    .map((id) => manifest[id]?.href)
    .filter(Boolean)
    .map((href) => basePath + href);
}
