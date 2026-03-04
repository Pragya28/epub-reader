import JSZip from "jszip";
import { resolvePath } from "../utilities";
import type { ManifestItem, ProcessedCss } from "../interface";

export async function processCssFiles(
  zip: JSZip,
  manifest: Record<string, ManifestItem>,
  basePath: string,
): Promise<ProcessedCss> {
  const blobUrls: string[] = [];
  let combinedCss = "";

  for (const { href } of Object.values(manifest)) {
    if (!href.endsWith(".css")) continue;

    const cssFullPath = basePath + href;
    const cssFile = zip.file(cssFullPath);
    if (!cssFile) continue;

    let cssContent = await cssFile.async("string");
    const cssBasePath = cssFullPath.substring(
      0,
      cssFullPath.lastIndexOf("/") + 1,
    );

    const urlRegex = /url\(([^)]+)\)/g;
    for (const match of [...cssContent.matchAll(urlRegex)]) {
      const rawUrl = match[1].trim().replace(/['"]/g, "");
      if (rawUrl.startsWith("data:")) continue;

      const resolvedPath = resolvePath(cssBasePath, rawUrl);
      const assetFile = zip.file(resolvedPath);
      if (!assetFile) continue;

      const blob = await assetFile.async("blob");
      const blobUrl = URL.createObjectURL(blob);
      blobUrls.push(blobUrl);

      cssContent = cssContent.replace(match[0], `url("${blobUrl}")`);
    }

    combinedCss += cssContent;
  }

  return { combinedCss, blobUrls };
}
