import JSZip from "jszip";

export type EpubParseErrorCode = "corrupted" | "unsupported" | "drm";

export class EpubParseError extends Error {
  readonly code: EpubParseErrorCode;

  constructor(code: EpubParseErrorCode, message: string) {
    super(message);
    this.name = "EpubParseError";
    this.code = code;
  }
}

export interface EpubExtractionResult {
  zip: JSZip;
  opfPath: string;
  opfXml: Document;
}

export interface EpubService {
  extractOpf(file: Blob): Promise<EpubExtractionResult>;
}

export interface ParsedEpubMetadata {
  title: string;
  author: string;
  language: string | null;
}

export interface ManifestItem {
  href: string;
  properties: string;
}

export interface ParsedEpub {
  metadata: ParsedEpubMetadata;
  manifest: Record<string, ManifestItem>;
  spine: string[];
  coverItem?: ManifestItem;
}

export interface ParsedChapter {
  id: string;
  href: string;
  content: string;
  stylesheets: string[];
  assetMap: Map<string, string>;
}

export interface TocItem {
  label: string;
  /** Raw href as it appears in the TOC source (relative to OPF directory). */
  href: string;
  children: TocItem[];
  /**
   * Spine index of the chapter this item points to, resolved at parse time.
   * -1 if the href couldn't be matched to any spine item.
   */
  chapterIndex: number;
  /**
   * Fragment identifier from the href (the part after '#'), if any.
   * Used to scroll to a specific element within the chapter.
   */
  fragmentId?: string;
}

export interface ParsedBook {
  metadata: ParsedEpubMetadata;
  chapters: ParsedChapter[];
  toc: TocItem[];
}

export interface ParsedLibraryBook {
  metadata: ParsedEpubMetadata;
  cover?: Blob;
}
