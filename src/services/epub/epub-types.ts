import JSZip from "jszip";

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
  href: string;
  children: TocItem[];
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
