import JSZip from "jszip";
import type { ManifestItem, TOC } from "../interface";

export async function parseToc(
  zip: JSZip,
  manifest: Record<string, ManifestItem>,
  basePath: string,
): Promise<TOC[]> {
  const navEntry = Object.values(manifest).find(
    ({ properties }) => properties === "nav",
  );
  if (!navEntry) return [];

  const navFile = zip.file(basePath + navEntry.href);
  if (!navFile) return [];

  const navContent = await navFile.async("string");
  const navDoc = new DOMParser().parseFromString(
    navContent,
    "application/xhtml+xml",
  );

  const nav = navDoc.querySelector("nav");
  if (!nav) return [];

  const toc: TOC[] = [];
  nav.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href")?.split("#")[0];
    const label = link.textContent?.trim();
    if (href && label) toc.push({ label, href: basePath + href });
  });

  return toc;
}
