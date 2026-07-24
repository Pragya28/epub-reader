import type JSZip from "jszip";
import type { ParsedEpub, TocItem } from "../epub-types";

/** Pre-resolution TOC item — chapterIndex/fragmentId not yet computed. */
type RawTocItem = {
  label: string;
  href: string;
  children: RawTocItem[];
};

/**
 * Parses the EPUB table of contents into a TocItem tree.
 *
 * Strategy (in priority order):
 *   1. EPUB3 Navigation Document — manifest item with properties="nav",
 *      parsed from the <nav epub:type="toc"> element.
 *   2. EPUB2 NCX — manifest item with media-type="application/x-dtbncx+xml",
 *      or the spine's toc attribute pointing to a manifest id.
 *   3. Empty array — if neither exists (graceful degradation).
 *
 * href values in the parsed items are kept as-is (relative to the OPF
 * directory). chapterIndex and fragmentId are resolved against the spine
 * at parse time so callers don't need to know the manifest layout.
 */
export class TocParser {
  async parse(
    zip: JSZip,
    parsedEpub: ParsedEpub,
    opfDirectory: string,
  ): Promise<TocItem[]> {
    // --- Try EPUB3 nav first ---
    const navItem = Object.values(parsedEpub.manifest).find((item) =>
      item.properties.includes("nav"),
    );

    if (navItem) {
      const navPath = this.resolvePath(opfDirectory, navItem.href);
      const navFile = zip.file(navPath);
      if (navFile) {
        const xml = await navFile.async("text");
        const doc = new DOMParser().parseFromString(
          xml,
          "application/xhtml+xml",
        );
        const items = this.parseNav(doc);
        return this.resolveChapterIndices(items, parsedEpub, opfDirectory);
      }
    }

    // --- Fallback: EPUB2 NCX ---
    const ncxItem = Object.values(parsedEpub.manifest).find((item) =>
      item.href.endsWith(".ncx"),
    );

    if (ncxItem) {
      const ncxPath = this.resolvePath(opfDirectory, ncxItem.href);
      const ncxFile = zip.file(ncxPath);
      if (ncxFile) {
        const xml = await ncxFile.async("text");
        const doc = new DOMParser().parseFromString(xml, "application/xml");
        const items = this.parseNcx(doc);
        return this.resolveChapterIndices(items, parsedEpub, opfDirectory);
      }
    }

    return [];
  }

  // ---- EPUB3 Nav ----

  private parseNav(doc: Document): RawTocItem[] {
    // The toc nav is identified by epub:type="toc". Use attribute selector
    // since the epub: namespace prefix varies across books.
    const tocNav =
      doc.querySelector('nav[epub\\:type="toc"]') ??
      doc.querySelector('nav[*|type="toc"]') ??
      // Last resort: first <nav> in the document
      doc.querySelector("nav");

    if (!tocNav) return [];

    const rootOl = tocNav.querySelector("ol");
    if (!rootOl) return [];

    return this.parseNavOl(rootOl);
  }

  private parseNavOl(ol: Element): RawTocItem[] {
    const items: RawTocItem[] = [];

    // Direct <li> children only — not grandchildren
    for (const li of ol.children) {
      if (li.tagName.toLowerCase() !== "li") continue;

      const anchor = li.querySelector(":scope > a, :scope > span");
      if (!anchor) continue;

      const label = anchor.textContent?.trim() ?? "";
      const href = anchor.getAttribute("href") ?? "";

      const childOl = li.querySelector(":scope > ol");
      const children = childOl ? this.parseNavOl(childOl) : [];

      items.push({ label, href, children });
    }

    return items;
  }

  // ---- EPUB2 NCX ----

  private parseNcx(doc: Document): RawTocItem[] {
    const navMap = doc.querySelector("navMap");
    if (!navMap) return [];

    return this.parseNcxPoints(navMap, true);
  }

  private parseNcxPoints(parent: Element, directOnly: boolean): RawTocItem[] {
    const items: RawTocItem[] = [];

    const points = directOnly
      ? Array.from(parent.children).filter(
          (el) => el.tagName.toLowerCase() === "navpoint",
        )
      : Array.from(parent.querySelectorAll(":scope > navPoint"));

    for (const point of points) {
      const labelEl = point.querySelector("navLabel > text");
      const label = labelEl?.textContent?.trim() ?? "";

      const contentEl = point.querySelector("content");
      const href = contentEl?.getAttribute("src") ?? "";

      const children = this.parseNcxPoints(point, false);

      items.push({ label, href, children });
    }

    return items;
  }

  // ---- Spine resolution ----

  /**
   * Walks the flat spine to resolve each TocItem's href to a chapterIndex.
   *
   * The href in a TOC item looks like "text/chapter-1.xhtml" or
   * "text/chapter-3.xhtml#section-2". The spine manifest hrefs look like
   * "text/chapter-1.xhtml". Both are relative to the OPF directory, so
   * we just strip the fragment and compare paths directly.
   *
   * We build a lookup map from normalized path → spine index once, then
   * walk the whole TocItem tree.
   */
  private resolveChapterIndices(
    items: RawTocItem[],
    parsedEpub: ParsedEpub,
    opfDirectory: string,
  ): TocItem[] {
    // Build path → spine index map
    const pathToIndex = new Map<string, number>();
    for (let i = 0; i < parsedEpub.spine.length; i++) {
      const manifestId = parsedEpub.spine[i];
      const item = parsedEpub.manifest[manifestId];
      if (item) {
        // Normalize: resolve relative to opfDirectory, strip leading slash
        const normalized = this.normalizePath(opfDirectory, item.href);
        pathToIndex.set(normalized, i);
      }
    }

    return this.resolveItems(items, pathToIndex, opfDirectory);
  }

  private resolveItems(
    items: RawTocItem[],
    pathToIndex: Map<string, number>,
    opfDirectory: string,
  ): TocItem[] {
    return items.map((item) => {
      const [pathPart, fragmentId] = item.href.split("#") as [
        string,
        string | undefined,
      ];
      const normalized = this.normalizePath(opfDirectory, pathPart);
      const chapterIndex = pathToIndex.get(normalized) ?? -1;

      return {
        ...item,
        chapterIndex,
        fragmentId: fragmentId || undefined,
        children: this.resolveItems(item.children, pathToIndex, opfDirectory),
      };
    });
  }

  // ---- Utilities ----

  private normalizePath(opfDirectory: string, relativePath: string): string {
    return new URL(relativePath, `http://epub/${opfDirectory}`).pathname.slice(
      1,
    );
  }

  private resolvePath(opfDirectory: string, href: string): string {
    return new URL(href, `http://epub/${opfDirectory}`).pathname.slice(1);
  }
}
