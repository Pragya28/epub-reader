import JSZip from "jszip";

export interface EpubExtractionResult {
  zip: JSZip;
  opfPath: string;
  opfXml: Document;
}

export interface EpubService {
  extractOpf(file: File): Promise<EpubExtractionResult>;
}

export interface ParsedEpubMetadata {
  title: string;
  author: string;
  language?: string;
}

export interface ParsedEpub {
  metadata: ParsedEpubMetadata;
  manifest: Record<string, string>;
  spine: string[];
}
