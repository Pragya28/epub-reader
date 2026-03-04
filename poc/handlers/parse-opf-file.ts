import JSZip from "jszip";
import type { BookMetadata, ManifestItem, ParsedOpf } from "../interface";

export async function parseOpfFile(
  zip: JSZip,
  opfPath: string,
): Promise<ParsedOpf> {
  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error("OPF file not found");

  const opfString = await opfFile.async("string");
  const opfDoc = new DOMParser().parseFromString(opfString, "application/xml");

  const title = opfDoc.querySelector(
    "metadata > title, metadata > dc\\:title",
  )?.textContent;
  const author = opfDoc.querySelector(
    "metadata > creator, metadata > dc\\:creator",
  )?.textContent;

  const metadata: BookMetadata = {
    title: title ?? "Not Available",
    author: author ?? "Unknown",
  };

  const manifest: Record<string, ManifestItem> = {};
  opfDoc.querySelectorAll("manifest > item").forEach((item) => {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    const properties = item.getAttribute("properties") ?? "";
    if (id && href) manifest[id] = { href, properties };
  });

  const spine: string[] = [];
  opfDoc.querySelectorAll("spine > itemref").forEach((item) => {
    const idref = item.getAttribute("idref");
    if (idref) spine.push(idref);
  });

  const basePath = opfPath.substring(0, opfPath.lastIndexOf("/") + 1);

  return { metadata, manifest, spine, basePath };
}
