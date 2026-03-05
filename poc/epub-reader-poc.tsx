import React, { useMemo } from "react";
import { useChapterJump } from "./hooks/chapter-jump";
import { useChapterRenderer } from "./hooks/chapter-renderer";
import { useEpubLoader } from "./hooks/epub-loader";
import { useIframeEvents } from "./hooks/iframe-events";
import { useScrollEngine } from "./hooks/scroll-engine";
import "./epub-reader-poc.css";

export const EpubReaderPoc: React.FC = () => {
  // ---- Refs shared across hooks ----
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const cssBlobUrlsRef = React.useRef<string[]>([]);
  const chapterBlobUrlsRef = React.useRef<string[]>([]);
  const loadedChaptersRef = React.useRef<Set<number>>(new Set());
  const isLoadingChapterRef = React.useRef(false);
  const isJumpingRef = React.useRef(false);
  const visibleChapterRef = React.useRef(0);
  const readingOrderRef = React.useRef<string[]>([]);
  const renderChapterRef = React.useRef<(index: number) => Promise<void>>(
    async () => {},
  );

  // ---- UI state ----
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [visibleChapter, setVisibleChapter] = React.useState(0);

  // ---- Hooks ----
  const { zipFile, readingOrder, bookMetadata, combinedCss, toc, handleFile } =
    useEpubLoader({
      iframeRef,
      cssBlobUrlsRef,
      chapterBlobUrlsRef,
      loadedChaptersRef,
      isLoadingChapterRef,
      isJumpingRef,
      readingOrderRef,
    });

  const { renderChapter } = useChapterRenderer({
    zipFile,
    readingOrder,
    combinedCss,
    iframeRef,
    chapterBlobUrlsRef,
    loadedChaptersRef,
    renderChapterRef,
  });

  const { jumpToChapter } = useChapterJump({
    iframeRef,
    loadedChaptersRef,
    isJumpingRef,
    visibleChapterRef,
    renderChapter,
    setCurrentIndex,
    setVisibleChapter,
  });

  useScrollEngine({
    iframeRef,
    readingOrderRef,
    loadedChaptersRef,
    isLoadingChapterRef,
    isJumpingRef,
    visibleChapterRef,
    renderChapterRef,
    setVisibleChapter,
  });

  useIframeEvents({ iframeRef, readingOrder, setCurrentIndex });

  // Render chapter whenever currentIndex changes
  React.useEffect(() => {
    if (zipFile && readingOrder[currentIndex]) {
      renderChapter(currentIndex);
    }
  }, [zipFile, readingOrder, currentIndex, renderChapter]);

  const chapterIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    readingOrder.forEach((path, index) => map.set(path, index));
    return map;
  }, [readingOrder]);

  return (
    <div className="epub-reader">
      <div className="epub-reader__toolbar">
        <input type="file" accept=".epub" onChange={handleFile} />
        {zipFile && (
          <div className="epub-reader__metadata">
            {bookMetadata?.title} — {bookMetadata?.author}
          </div>
        )}
      </div>

      <div className="epub-reader__body">
        {toc.length > 0 && (
          <div className="epub-reader__toc">
            <h3>Table of Contents</h3>
            {toc.map((item, i) => {
              const isActive =
                visibleChapter === chapterIndexMap.get(item.href);
              return (
                <div
                  key={i}
                  className={`epub-reader__toc-item${isActive ? " epub-reader__toc-item--active" : ""}`}
                  onClick={() => {
                    const index = chapterIndexMap.get(item.href);
                    if (index !== undefined) jumpToChapter(index);
                  }}
                >
                  {item.label}
                </div>
              );
            })}
          </div>
        )}

        <iframe ref={iframeRef} className="epub-reader__iframe" />
      </div>

      {zipFile && (
        <div className="epub-reader__pagination">
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
          >
            Previous
          </button>
          <span className="epub-reader__pagination-label">
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
