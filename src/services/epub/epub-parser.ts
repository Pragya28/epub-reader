import { EpubServiceImpl } from "./epub.service";

import { ChapterParser } from "./parsers/chapter-parser";
import { OpfParser } from "./parsers/opf-parser";

import type { ParsedBook, ParsedEpub, ParsedEpubMetadata } from "./epub-types";

export class EpubParser {
  private readonly epubService = new EpubServiceImpl();

  private readonly opfParser = new OpfParser();

  private readonly chapterParser = new ChapterParser();

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

    const chapters = await this.chapterParser.parseAllChapters(
      extraction.zip,
      parsedEpub,
      this.getOpfDirectory(extraction.opfPath),
    );

    return {
      metadata: parsedEpub.metadata,
      chapters,
      toc: [],
    };
  }

  private getOpfDirectory(opfPath: string): string {
    const index = opfPath.lastIndexOf("/");
    return index === -1 ? "" : opfPath.slice(0, index + 1);
  }
}
