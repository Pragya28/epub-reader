import { EpubServiceImpl } from "./epub.service";

import { ChapterParser } from "./parsers/chapter-parser";
import { OpfParser } from "./parsers/opf-parser";
import { TocParser } from "./parsers/toc-parser";

import type {
  ManifestItem,
  ParsedBook,
  ParsedEpub,
  ParsedEpubMetadata,
  ParsedLibraryBook,
} from "./epub-types";
import type JSZip from "jszip";

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

  async parseBook(file: Blob): Promise<ParsedBook> {
    const extraction = await this.epubService.extractOpf(file);

    const parsedEpub = this.opfParser.parse(extraction.opfXml);

    const opfDirectory = this.getOpfDirectory(extraction.opfPath);

    const [chapters, toc] = await Promise.all([
      this.chapterParser.parseAllChapters(
        extraction.zip,
        parsedEpub,
        opfDirectory,
      ),
      this.tocParser.parse(extraction.zip, parsedEpub, opfDirectory),
    ]);

    return {
      metadata: parsedEpub.metadata,
      chapters,
      toc,
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
