export interface BookMetadata {
  title: string;
  author: string;
}

export interface TOC {
  label: string;
  href: string;
}

export interface ManifestItem {
  href: string;
  properties: string;
}

export interface ParsedOpf {
  metadata: BookMetadata;
  manifest: Record<string, ManifestItem>;
  spine: string[];
  basePath: string;
}

export interface ProcessedCss {
  combinedCss: string;
  blobUrls: string[];
}

export interface ResolvedChapterImages {
  blobUrls: string[];
}
