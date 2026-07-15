import type {
  ManifestItem,
  ParsedEpub,
  ParsedEpubMetadata,
} from "../epub-types";

export class OpfParser {
  parse(opfXml: Document): ParsedEpub {
    const metadata = this.parseMetadata(opfXml);
    const manifest = this.parseManifest(opfXml);
    const spine = this.parseSpine(opfXml);

    this.validateSpine(spine, manifest);
    const coverItem = this.findCover(opfXml, manifest);

    return {
      metadata,
      manifest,
      spine,
      coverItem,
    };
  }

  // ---- Metadata ----
  private parseMetadata(opfXml: Document): ParsedEpubMetadata {
    const metadata = this.getDocumentElement(opfXml, [
      "metadata",
      "opf:metadata",
    ]);
    if (!metadata) throw new Error("metadata not found");

    const title =
      this.getTextContent(metadata, ["title", "dc:title"]) ?? "Not Available";
    const author =
      this.getTextContent(metadata, ["creator", "dc:creator"]) ?? "Unknown";
    const language = this.getTextContent(metadata, ["language", "dc:language"]);
    return { title, author, language };
  }

  // ---- Manifest ----
  private parseManifest(opfXml: Document): Record<string, ManifestItem> {
    const manifest = this.getDocumentElement(opfXml, [
      "manifest",
      "opf:manifest",
    ]);
    if (!manifest) throw new Error("manifest not found");

    const items = this.getAllDocumentElements(manifest, "item");
    const manifestData: Record<string, ManifestItem> = {};
    if (items.length === 0) throw new Error("manifest is empty");
    items.forEach((item) => {
      const id = this.getElementAttribute(item, "id");
      const href = this.getElementAttribute(item, "href");
      const properties = this.getElementAttribute(item, "properties") ?? "";

      if (id && href) manifestData[id] = { href, properties };
    });
    return manifestData;
  }

  // ---- Spine ----
  private parseSpine(opfXml: Document): string[] {
    const spine = this.getDocumentElement(opfXml, ["spine", "opf:spine"]);
    if (!spine) throw new Error("spine not found");
    const items = this.getAllDocumentElements(spine, "itemref");
    if (items.length === 0) throw new Error("spine is empty");
    const spineItems: string[] = [];
    items.forEach((item) => {
      const idref = this.getElementAttribute(item, "idref");
      if (idref) spineItems.push(idref);
    });
    if (spineItems.length === 0) throw new Error("spine itemref missing idref");
    return spineItems;
  }

  private validateSpine(
    spine: string[],
    manifest: Record<string, ManifestItem>,
  ): void {
    for (const idref of spine) {
      if (!manifest[idref]) {
        throw new Error(`Invalid spine reference: ${idref}`);
      }
    }
  }

  // ---- Cover ----
  private findCover(
    opfXml: Document,
    manifest: Record<string, ManifestItem>,
  ): ManifestItem | undefined {
    // EPUB 3
    for (const item of Object.values(manifest)) {
      if (item.properties.includes("cover-image")) {
        return item;
      }
    }

    // EPUB 2
    const metadata = this.getDocumentElement(opfXml, [
      "metadata",
      "opf:metadata",
    ]);

    const coverMeta = metadata?.querySelector('meta[name="cover"]');

    const coverId = coverMeta?.getAttribute("content");

    if (coverId && manifest[coverId]) {
      return manifest[coverId];
    }

    // fallback
    return Object.values(manifest).find((item) => /cover/i.test(item.href));
  }

  // ---- Utilities ----
  private getDocumentElement(
    opf: Document,
    tagNames: string[],
  ): Element | null {
    for (const tag of tagNames) {
      const el = opf.getElementsByTagName(tag)[0];

      if (el) return el;
    }

    return null;
  }

  private getAllDocumentElements(
    opf: Element,
    query: string,
  ): NodeListOf<Element> {
    return opf.querySelectorAll(query);
  }

  private getElementAttribute(ele: Element, attr: string): string | null {
    return ele.getAttribute(attr);
  }

  private getTextContent(parent: Element, tagNames: string[]): string | null {
    for (const tag of tagNames) {
      const el = parent.getElementsByTagName(tag)[0];

      if (el?.textContent?.trim()) {
        return el.textContent.trim();
      }
    }

    return null;
  }
}
