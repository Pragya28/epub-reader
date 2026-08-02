import { EpubServiceImpl } from "./epub.service";

import { ChapterParser } from "./parsers/chapter-parser";
import { OpfParser } from "./parsers/opf-parser";
import { TocParser } from "./parsers/toc-parser";
import { logger as rootLogger } from "@/shared/logger/logger";

import type {
  ManifestItem,
  ParsedBook,
  ParsedChapter,
  ParsedEpub,
  ParsedEpubMetadata,
  ParsedLibraryBook,
} from "./epub-types";
import type JSZip from "jszip";

const logger = rootLogger.child("epub-parser");

export class EpubParser {
  private readonly epubService = new EpubServiceImpl();
  private readonly opfParser = new OpfParser();
  private readonly chapterParser = new ChapterParser();
  private readonly tocParser = new TocParser();

  async parseMetadata(file: Blob): Promise<ParsedEpubMetadata> {
    const parsed = await this.parseOpf(file);

    return parsed.metadata;
  }

  async parseOpf(file: Blob): Promise<ParsedEpub> {
    const extraction = await this.epubService.extractOpf(file);

    return this.opfParser.parse(extraction.opfXml);
  }

  /**
   * Chapter bodies are NOT parsed here — only metadata/manifest/spine
   * (cheap, no zip decompression of chapter content) plus the TOC (its own
   * small nav/ncx file, not chapter bodies). `chapters` comes back as
   * stubs; each chapter's actual content/stylesheets/assets are parsed on
   * demand via the returned `loadChapter`, matching the reader's existing
   * chapter-window (only ~5 chapters ever mounted at once) instead of
   * eagerly parsing and blob-minting assets for an entire book — 300+
   * chapters, most of which may never be opened — before first paint.
   */
  async parseBook(file: Blob): Promise<ParsedBook> {
    const extraction = await this.epubService.extractOpf(file);

    const parsedEpub = this.opfParser.parse(extraction.opfXml);

    const opfDirectory = this.getOpfDirectory(extraction.opfPath);

    const [toc, stylesheets] = await Promise.all([
      this.tocParser.parse(extraction.zip, parsedEpub, opfDirectory),
      this.chapterParser.loadBookStylesheets(
        extraction.zip,
        parsedEpub,
        opfDirectory,
      ),
    ]);

    const chapters = parsedEpub.spine.map((_, index) =>
      this.chapterParser.createChapterStub(parsedEpub, index),
    );

    const loadCache = new Map<number, Promise<ParsedChapter>>();

    const loadChapter = (index: number): Promise<ParsedChapter> => {
      const cached = loadCache.get(index);
      if (cached) return cached;

      const promise = this.chapterParser
        .parseChapter(extraction.zip, parsedEpub, index, opfDirectory)
        .catch((error) => {
          logger.error(
            `failed to load chapter at spine index ${index}, using fallback`,
            error,
          );
          return this.chapterParser.createFallbackChapter(parsedEpub, index);
        })
        .then((parsed) => {
          chapters[index] = parsed;
          return parsed;
        });

      loadCache.set(index, promise);
      return promise;
    };

    return {
      metadata: parsedEpub.metadata,
      chapters,
      toc,
      stylesheets,
      loadChapter,
    };
  }

  async parseLibraryBook(file: Blob): Promise<ParsedLibraryBook> {
    const extraction = await this.epubService.extractOpf(file);

    const parsed = this.opfParser.parse(extraction.opfXml);

    const cover = await this.loadCover(
      extraction.zip,
      parsed.coverItem,
      this.getOpfDirectory(extraction.opfPath),
    );

    return {
      metadata: parsed.metadata,
      cover,
    };
  }

  private getOpfDirectory(opfPath: string): string {
    const index = opfPath.lastIndexOf("/");
    return index === -1 ? "" : opfPath.slice(0, index + 1);
  }

  private async loadCover(
    zip: JSZip,
    coverItem: ManifestItem | undefined,
    opfDirectory: string,
  ): Promise<Blob | undefined> {
    if (!coverItem) return undefined;

    const path = new URL(
      coverItem.href,
      `http://epub/${opfDirectory}`,
    ).pathname.slice(1);

    const file = zip.file(path);

    if (!file) return undefined;

    const blob = new Blob([await file.async("arraybuffer")]);

    return blob;
  }
}
