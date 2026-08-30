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
    const guideStartHref = this.findGuideStart(opfXml);

    return {
      metadata,
      manifest,
      spine,
      coverItem,
      guideStartHref,
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
    const rawDescription = this.getTextContent(metadata, [
      "description",
      "dc:description",
    ]);
    const description = rawDescription
      ? this.stripHtml(rawDescription)
      : rawDescription;

    const { seriesName, seriesIndex } = this.parseSeries(metadata);

    return { title, author, language, description, seriesName, seriesIndex };
  }

  /**
   * Series come from either Calibre's `calibre:series` convention or the
   * EPUB3 standard `belongs-to-collection` (with a `collection-type` of
   * "series", refined via `refines="#id"`). Calibre wins when both are
   * present since it's unambiguous; belongs-to-collection entries typed
   * "set" (not "series") are ignored.
   */
  private parseSeries(metadata: Element): {
    seriesName?: string;
    seriesIndex?: number;
  } {
    const calibreName = this.getMetaContent(metadata, "calibre:series");
    if (calibreName) {
      const indexRaw = this.getMetaContent(metadata, "calibre:series_index");
      const seriesIndex =
        indexRaw !== null && !Number.isNaN(Number(indexRaw))
          ? Number(indexRaw)
          : undefined;
      return { seriesName: calibreName, seriesIndex };
    }

    const collections = Array.from(
      metadata.querySelectorAll('meta[property="belongs-to-collection"]'),
    );
    const collectionType = (el: Element): string | undefined => {
      const id = el.getAttribute("id");
      const typeMeta = id
        ? metadata.querySelector(
            `meta[property="collection-type"][refines="#${CSS.escape(id)}"]`,
          )
        : null;
      return typeMeta?.textContent?.trim();
    };
    const seriesCollection =
      collections.find((el) => collectionType(el) === "series") ??
      collections.find((el) => collectionType(el) === undefined);

    const seriesName = seriesCollection?.textContent?.trim() || undefined;
    if (!seriesName) return {};

    const collectionId = seriesCollection?.getAttribute("id");
    const positionMeta = collectionId
      ? metadata.querySelector(
          `meta[property="group-position"][refines="#${CSS.escape(collectionId)}"]`,
        )
      : null;
    const positionRaw = positionMeta?.textContent?.trim();
    const seriesIndex =
      positionRaw && !Number.isNaN(Number(positionRaw))
        ? Number(positionRaw)
        : undefined;

    return { seriesName, seriesIndex };
  }

  /**
   * Reads a generic `<meta name="...">` element's `content` attribute —
   * distinct from `getTextContent`, which only reads named tags' own text.
   * Calibre's series convention (and EPUB2's cover convention, see
   * findCover) is expressed this way rather than as a dedicated tag.
   */
  private getMetaContent(metadata: Element, name: string): string | null {
    const meta = metadata.querySelector(`meta[name="${name}"]`);
    const content = meta?.getAttribute("content")?.trim();
    return content ? content : null;
  }

  /**
   * Some EPUBs' dc:description is itself HTML, escaped as plain text (e.g.
   * literal `&lt;p&gt;...&lt;/p&gt;`) rather than real child elements —
   * textContent alone doesn't strip that, since it's not markup as far as
   * the OPF's own XML parser is concerned. Re-parsing it as HTML and
   * reading textContent again removes it either way.
   *
   * Block boundaries are converted to blank lines first — plain
   * `textContent` on the reparsed doc would otherwise concatenate
   * `<p>A</p><p>B</p>` into "AB" with no separator, collapsing every
   * paragraph break in the description into one run-on paragraph.
   */
  private stripHtml(text: string): string {
    const withBreaks = text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div)>/gi, "\n\n");
    const doc = new DOMParser().parseFromString(withBreaks, "text/html");
    return doc.body.textContent?.replace(/\n{3,}/g, "\n\n").trim() ?? text;
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
  /**
   * `linear="no"` itemrefs are supplementary (footnote/popup pages) and
   * excluded from the main reading flow — same convention ebooklib follows.
   */
  private parseSpine(opfXml: Document): string[] {
    const spine = this.getDocumentElement(opfXml, ["spine", "opf:spine"]);
    if (!spine) throw new Error("spine not found");
    const items = this.getAllDocumentElements(spine, "itemref");
    if (items.length === 0) throw new Error("spine is empty");
    const spineItems: string[] = [];
    items.forEach((item) => {
      if (this.getElementAttribute(item, "linear") === "no") return;
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

    // fallback: a manifest href containing "cover" — but only an image, so a
    // cover *page* (cover.xhtml), stylesheet (cover.css), or an unrelated file
    // like discovery.xhtml isn't mistaken for the cover image.
    return Object.values(manifest).find(
      (item) =>
        /cover/i.test(item.href) &&
        /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(item.href),
    );
  }

  // ---- Guide (EPUB2 start-of-content) ----
  private findGuideStart(opfXml: Document): string | undefined {
    const guide = this.getDocumentElement(opfXml, ["guide", "opf:guide"]);
    if (!guide) return undefined;

    const references = Array.from(guide.querySelectorAll("reference"));
    const byType = (type: string) =>
      references.find((ref) => ref.getAttribute("type") === type);

    const reference = byType("text") ?? byType("bodymatter") ?? byType("start");

    return reference?.getAttribute("href") ?? undefined;
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
