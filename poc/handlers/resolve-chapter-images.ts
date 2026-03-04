import JSZip from "jszip";
import { resolvePath } from "../utilities";
import type { ResolvedChapterImages } from "../interface";

export async function resolveChapterImages(
  chapterDoc: Document,
  chapterBasePath: string,
  zip: JSZip,
): Promise<ResolvedChapterImages> {
  const blobUrls: string[] = [];

  for (const img of chapterDoc.querySelectorAll("img")) {
    const src = img.getAttribute("src");
    if (!src) continue;

    const resolvedPath = resolvePath(chapterBasePath, src);
    const file = zip.file(resolvedPath);
    if (!file) continue;

    const blob = await file.async("blob");
    const blobUrl = URL.createObjectURL(blob);
    blobUrls.push(blobUrl);

    img.setAttribute("src", blobUrl);
  }

  return { blobUrls };
}
