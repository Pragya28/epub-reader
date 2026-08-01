import DOMPurify from "dompurify";
import type JSZip from "jszip";
import type { ManifestItem, ParsedChapter, ParsedEpub } from "../epub-types";
import { SANITIZE_CONFIG } from "@/constants/sanitize-config";
import { logger as rootLogger } from "@/shared/logger/logger";

const logger = rootLogger.child("chapter-parser");

export class ChapterParser {
  async parseChapter(
    zip: JSZip,
    parsedEpub: ParsedEpub,
    spineIndex: number,
    opfDirectory: string,
  ): Promise<ParsedChapter> {
    const manifestItem = this.getSpineManifestItem(parsedEpub, spineIndex);

    const chapterPath = this.resolvePath(opfDirectory, manifestItem.href);

    const chapterContent = await this.loadChapterContent(zip, chapterPath);

    const chapterDoc = this.parseChapterDocument(chapterContent);

    const chapterBasePath = this.getBasePath(chapterPath);

    const { html, assetMap } = await this.resolveChapterAssets(
      chapterDoc,
      chapterBasePath,
      zip,
    );

    const stylesheets = await this.loadChapterStylesheets(
      zip,
      chapterDoc,
      chapterBasePath,
      assetMap,
    );

    return {
      id: parsedEpub.spine[spineIndex],
      href: manifestItem.href,
      content: html,
      stylesheets,
      assetMap,
    };
  }

  async parseAllChapters(
    zip: JSZip,
    parsedEpub: ParsedEpub,
    opfDirectory: string,
  ): Promise<ParsedChapter[]> {
    const chapters: ParsedChapter[] = [];

    for (let i = 0; i < parsedEpub.spine.length; i++) {
      try {
        chapters.push(
          await this.parseChapter(zip, parsedEpub, i, opfDirectory),
        );
      } catch (error) {
        // One malformed/missing chapter file shouldn't sink the whole book —
        // a reader who can't get past chapter 12 of 40 because chapter 13's
        // file is corrupt is worse off than one who sees a placeholder there
        // and keeps reading. Mirrors the reader engine's own
        // mountChapterFallback() for the equivalent render-time failure.
        logger.error(
          `failed to parse chapter at spine index ${i}, using fallback`,
          error,
        );
        chapters.push(this.createFallbackChapter(parsedEpub, i));
      }
    }

    return chapters;
  }

  private createFallbackChapter(
    parsedEpub: ParsedEpub,
    spineIndex: number,
  ): ParsedChapter {
    const spineId = parsedEpub.spine[spineIndex] ?? `spine-${spineIndex}`;
    const href = parsedEpub.manifest[spineId]?.href ?? spineId;

    return {
      id: spineId,
      href,
      content: `<p class="chapter-parse-error">This chapter couldn't be loaded.</p>`,
      stylesheets: [],
      assetMap: new Map(),
    };
  }

  /**
   * XHTML entities like bare `&` are common in real-world EPUBs and make the
   * strict XML parser fail outright, replacing the whole chapter with the
   * browser's error document. Falling back to the lenient HTML parser
   * recovers readable content instead of losing the chapter.
   */
  private parseChapterDocument(chapterContent: string): Document {
    const xhtmlDoc = new DOMParser().parseFromString(
      chapterContent,
      "application/xhtml+xml",
    );

    if (!xhtmlDoc.querySelector("parsererror")) return xhtmlDoc;

    const htmlDoc = new DOMParser().parseFromString(
      chapterContent,
      "text/html",
    );

    if (htmlDoc.querySelector("parsererror")) {
      throw new Error("Malformed chapter markup");
    }

    return htmlDoc;
  }

  private getSpineManifestItem(
    parsedEpub: ParsedEpub,
    spineIndex: number,
  ): ManifestItem {
    const spineId = parsedEpub.spine[spineIndex];

    if (!spineId) {
      throw new Error(`Invalid spine index: ${spineIndex}`);
    }

    const manifestItem = parsedEpub.manifest[spineId];

    if (!manifestItem) {
      throw new Error(`Manifest item not found: ${spineId}`);
    }

    return manifestItem;
  }

  private async loadChapterContent(
    zip: JSZip,
    chapterPath: string,
  ): Promise<string> {
    const chapterFile = zip.file(chapterPath);

    if (!chapterFile) {
      throw new Error(`Chapter not found: ${chapterPath}`);
    }

    return chapterFile.async("string");
  }

  private async loadChapterStylesheets(
    zip: JSZip,
    chapterDoc: Document,
    chapterBasePath: string,
    assetMap: Map<string, string>,
  ): Promise<string[]> {
    const stylesheets: string[] = [];

    const links = chapterDoc.querySelectorAll('link[rel="stylesheet"]');

    for (const link of links) {
      const href = link.getAttribute("href");

      if (!href) continue;

      const cssPath = this.resolvePath(chapterBasePath, href);

      const cssFile = zip.file(cssPath);

      if (!cssFile) continue;

      const cssText = await cssFile.async("string");
      const cssBasePath = this.getBasePath(cssPath);

      const resolvedCss = await this.resolveCssAssets(
        cssText,
        cssBasePath,
        zip,
        assetMap,
      );

      stylesheets.push(resolvedCss);
    }

    return stylesheets;
  }

  private async resolveChapterAssets(
    chapterDoc: Document,
    chapterBasePath: string,
    zip: JSZip,
  ): Promise<{
    html: string;
    assetMap: Map<string, string>;
  }> {
    const assetMap = new Map<string, string>();

    const images = chapterDoc.querySelectorAll("img");

    for (const image of images) {
      const src = image.getAttribute("src");

      if (!src) continue;

      const assetPath = this.resolvePath(chapterBasePath, src);

      const assetFile = zip.file(assetPath);

      if (!assetFile) continue;

      const buffer = await assetFile.async("arraybuffer");

      const blob = new Blob([buffer]);

      const blobUrl = URL.createObjectURL(blob);

      assetMap.set(src, blobUrl);

      image.setAttribute("src", blobUrl);
      image.setAttribute("loading", "lazy");
    }

    // SVG <image> uses xlink:href (or bare href in EPUB3) instead of src.
    const svgImages = chapterDoc.querySelectorAll("image");

    for (const svgImage of svgImages) {
      const href =
        svgImage.getAttribute("xlink:href") ?? svgImage.getAttribute("href");

      if (!href) continue;

      const assetPath = this.resolvePath(chapterBasePath, href);

      const assetFile = zip.file(assetPath);

      if (!assetFile) continue;

      const buffer = await assetFile.async("arraybuffer");

      const blob = new Blob([buffer]);

      const blobUrl = URL.createObjectURL(blob);

      assetMap.set(href, blobUrl);

      if (svgImage.hasAttribute("xlink:href")) {
        svgImage.setAttribute("xlink:href", blobUrl);
      } else {
        svgImage.setAttribute("href", blobUrl);
      }
    }

    const rawHtml = chapterDoc.body?.innerHTML ?? "";
    const html = DOMPurify.sanitize(rawHtml, SANITIZE_CONFIG);

    return {
      html,
      assetMap,
    };
  }

  /**
   * Rewrites url(...) references inside a stylesheet (fonts, background
   * images, etc.) to blob URLs so they resolve inside the sandboxed iframe,
   * which has no access to the original zip contents. Paths are resolved
   * relative to the CSS file's own location, not the chapter's — a
   * stylesheet in styles/ referencing fonts/foo.woff must resolve against
   * styles/, not the (possibly different) chapter directory.
   *
   * Absolute URLs (url(https://...)) are neutralized rather than resolved:
   * left alone, they'd fire a real network request straight from the
   * sandboxed iframe with no JS required — sandbox="allow-same-origin"
   * doesn't block plain CSS resource loads — which is exactly the kind of
   * phone-home this local-first app's whole premise (nothing uploaded to a
   * server) rules out.
   */
  private async resolveCssAssets(
    cssText: string,
    cssBasePath: string,
    zip: JSZip,
    assetMap: Map<string, string>,
  ): Promise<string> {
    const urlPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
    const matches = [...cssText.matchAll(urlPattern)];

    let resolvedCss = cssText;

    for (const match of matches) {
      const rawUrl = match[2]?.trim();

      if (!rawUrl) continue;
      if (rawUrl.startsWith("data:")) continue;

      if (/^[a-z]+:\/\//i.test(rawUrl)) {
        resolvedCss = resolvedCss.split(match[0]).join("url()");
        continue;
      }

      const assetPath = this.resolvePath(cssBasePath, rawUrl);

      let blobUrl = assetMap.get(assetPath);

      if (!blobUrl) {
        const assetFile = zip.file(assetPath);

        if (!assetFile) continue;

        const buffer = await assetFile.async("arraybuffer");
        const blob = new Blob([buffer]);

        blobUrl = URL.createObjectURL(blob);
        assetMap.set(assetPath, blobUrl);
      }

      resolvedCss = resolvedCss.split(match[0]).join(`url("${blobUrl}")`);
    }

    return resolvedCss;
  }

  private getBasePath(chapterPath: string): string {
    const index = chapterPath.lastIndexOf("/");

    return index === -1 ? "" : chapterPath.slice(0, index + 1);
  }

  private resolvePath(basePath: string, relativePath: string): string {
    return new URL(relativePath, `http://epub/${basePath}`).pathname.slice(1);
  }
}
