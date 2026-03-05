import JSZip from "jszip";
import React from "react";
import { buildReadingOrder } from "../handlers/build-reading-order";
import { parseContainerXml } from "../handlers/parse-container-xml";
import { parseOpfFile } from "../handlers/parse-opf-file";
import { parseToc } from "../handlers/parse-toc";
import { processCssFiles } from "../handlers/process-css-files";
import type { BookMetadata, TOC } from "../interface";

interface UseEpubLoaderProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  cssBlobUrlsRef: React.RefObject<string[]>;
  chapterBlobUrlsRef: React.RefObject<string[]>;
  loadedChaptersRef: React.RefObject<Set<number>>;
  isLoadingChapterRef: React.RefObject<boolean>;
  isJumpingRef: React.RefObject<boolean>;
  readingOrderRef: React.RefObject<string[]>;
}

interface UseEpubLoaderReturn {
  zipFile: JSZip | null;
  readingOrder: string[];
  bookMetadata: BookMetadata | undefined;
  combinedCss: string;
  toc: TOC[];
  handleFile: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function useEpubLoader({
  iframeRef,
  cssBlobUrlsRef,
  chapterBlobUrlsRef,
  loadedChaptersRef,
  isLoadingChapterRef,
  isJumpingRef,
  readingOrderRef,
}: UseEpubLoaderProps): UseEpubLoaderReturn {
  const [zipFile, setZipFile] = React.useState<JSZip | null>(null);
  const [readingOrder, setReadingOrder] = React.useState<string[]>([]);
  const [bookMetadata, setBookMetadata] = React.useState<
    BookMetadata | undefined
  >();
  const [combinedCss, setCombinedCss] = React.useState("");
  const [toc, setToc] = React.useState<TOC[]>([]);

  // Revoke all blob URLs on unmount
  React.useEffect(() => {
    return () => {
      chapterBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      cssBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Reset all mutable state before loading a new file
    loadedChaptersRef.current.clear();
    isLoadingChapterRef.current = false;
    isJumpingRef.current = false;
    cssBlobUrlsRef.current = [];
    chapterBlobUrlsRef.current = [];

    const iframeDoc = iframeRef.current?.contentDocument;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(`
        <html>
          <head><style>img { max-width:100%; height:auto; }</style></head>
          <body></body>
        </html>
      `);
      iframeDoc.close();
      iframeDoc.defaultView?.scrollTo(0, 0);
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const zip = await JSZip.loadAsync(file);
    setZipFile(zip);

    const opfPath = await parseContainerXml(zip);
    const { metadata, manifest, spine, basePath } = await parseOpfFile(
      zip,
      opfPath,
    );
    setBookMetadata(metadata);

    const order = buildReadingOrder(spine, manifest, basePath);
    readingOrderRef.current = order;
    setReadingOrder(order);

    const { combinedCss, blobUrls } = await processCssFiles(
      zip,
      manifest,
      basePath,
    );
    setCombinedCss(combinedCss);
    cssBlobUrlsRef.current.push(...blobUrls);

    const toc = await parseToc(zip, manifest, basePath);
    setToc(toc);
  };

  return { zipFile, readingOrder, bookMetadata, combinedCss, toc, handleFile };
}
