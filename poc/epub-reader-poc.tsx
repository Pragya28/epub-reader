import JSZip from "jszip";
import React, { useCallback, useMemo } from "react";
import { buildReadingOrder } from "./handlers/build-reading-order";
import { parseContainerXml } from "./handlers/parse-container-xml";
import { parseOpfFile } from "./handlers/parse-opf-file";
import { parseToc } from "./handlers/parse-toc";
import { processCssFiles } from "./handlers/process-css-files";
import { resolveChapterImages } from "./handlers/resolve-chapter-images";
import type { BookMetadata, ManifestItem, TOC } from "./interface";

export const EpubReaderPoc: React.FC = () => {
  const cssBlobUrlsRef = React.useRef<string[]>([]);
  const chapterBlobUrlsRef = React.useRef<string[]>([]);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const [zipFile, setZipFile] = React.useState<JSZip | null>(null);
  const [readingOrder, setReadingOrder] = React.useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [basePath, setBasePath] = React.useState("");
  const [manifest, setManifest] = React.useState<Record<string, ManifestItem>>(
    {},
  );
  const [bookMetadata, setBookMetadata] = React.useState<
    BookMetadata | undefined
  >();
  const [combinedCss, setCombinedCss] = React.useState("");
  const [toc, setToc] = React.useState<TOC[]>([]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setManifest(manifest);
    setBasePath(basePath);
    const readingOrder = buildReadingOrder(spine, manifest, basePath);
    setReadingOrder(readingOrder);
    setCurrentIndex(0);

    const { combinedCss, blobUrls: cssBlobUrls } = await processCssFiles(
      zip,
      manifest,
      basePath,
    );
    setCombinedCss(combinedCss);
    cssBlobUrlsRef.current.push(...cssBlobUrls);

    const toc = await parseToc(zip, manifest, basePath);
    setToc(toc);
  };

  const chapterIndexMap = useMemo(() => {
    const map = new Map<string, number>();

    readingOrder.forEach((path, index) => {
      map.set(path, index);
    });

    return map;
  }, [readingOrder]);

  const renderChapter = useCallback(
    async (index: number) => {
      if (!zipFile || !readingOrder[index]) return;

      chapterBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      chapterBlobUrlsRef.current = [];

      const chapterPath = readingOrder[index];
      const chapterFile = zipFile.file(chapterPath);
      if (!chapterFile) return;

      const chapterContent = await chapterFile.async("string");
      const chapterDoc = new DOMParser().parseFromString(
        chapterContent,
        "application/xhtml+xml",
      );

      const head = chapterDoc.querySelector("head");
      if (head) {
        const metaViewport = chapterDoc.createElement("meta");
        metaViewport.setAttribute("name", "viewport");
        metaViewport.setAttribute(
          "content",
          "width=device-width, initial-scale=1",
        );
        head.appendChild(metaViewport);
      }

      const chapterBasePath = chapterPath.substring(
        0,
        chapterPath.lastIndexOf("/") + 1,
      );
      const { blobUrls: imageBlobUrls } = await resolveChapterImages(
        chapterDoc,
        chapterBasePath,
        zipFile,
      );
      chapterBlobUrlsRef.current.push(...imageBlobUrls);

      if (head && combinedCss) {
        const styleEl = chapterDoc.createElement("style");
        styleEl.textContent = combinedCss;
        head.appendChild(styleEl);
      }

      const serialized = new XMLSerializer().serializeToString(chapterDoc);
      if (iframeRef.current) {
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc) return;

        iframeDoc.open();
        iframeDoc.write(serialized);
        iframeDoc.close();
      }
    },
    [zipFile, readingOrder, combinedCss],
  );

  React.useEffect(() => {
    if (!readingOrder[currentIndex]) return;
    if (zipFile && readingOrder.length > 0) {
      renderChapter(currentIndex);
    }

    return () => {
      chapterBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [zipFile, readingOrder, currentIndex, renderChapter]);

  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <div style={{ alignSelf: "center" }}>
        <input type="file" accept=".epub" onChange={handleFile} />
        {zipFile && (
          <div style={{ margin: "10px 0", fontWeight: 600 }}>
            {bookMetadata?.title} — {bookMetadata?.author}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          padding: "48px",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {toc.length > 0 && (
          <div
            style={{
              flex: 0.3,
              display: "flex",
              flexDirection: "column",
              overflow: "scroll",
            }}
          >
            <h3>Table of Contents</h3>
            {toc.map((item, i) => (
              <div
                key={i}
                style={{ cursor: "pointer", margin: "4px 0" }}
                onClick={() => {
                  const index = chapterIndexMap.get(item.href);
                  if (index) setCurrentIndex(index);
                }}
              >
                {item.label}
              </div>
            ))}
          </div>
        )}
        <iframe
          ref={iframeRef}
          style={{ flex: 0.7, height: "80vh", border: "none" }}
        />
      </div>
      {zipFile && (
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
          >
            Previous
          </button>
          <span style={{ margin: "0 12px" }}>
            {currentIndex + 1} / {readingOrder.length}
          </span>
          <button
            onClick={() =>
              setCurrentIndex((i) => Math.min(readingOrder.length - 1, i + 1))
            }
            disabled={currentIndex === readingOrder.length - 1}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
