import { useEffect, useRef, useState, useCallback, type FC } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { loadReaderBook } from "@/features/reader/actions/load-reader-book";
import { jumpToTocItem } from "@/features/reader/actions/jump-to-toc-item";
import { ReaderFrame } from "@/features/reader/components/reader-frame";
import { useReaderEngine } from "@/features/reader/hooks/use-reader-engine";
import { readerStore } from "@/features/reader/store/reader-store";
import { BackIcon } from "@/assets/icons";
import type { TocItem } from "@/services/epub/epub-types";
import { TocIcon } from "@/assets/icons/toc-icon";
import { TocDrawer } from "@/features/reader/components/toc-drawer";

export const ReaderScreen: FC = () => {
  const navigate = useNavigate();
  const { bookId } = useParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [tocOpen, setTocOpen] = useState(false);

  const { readerDocument, parsedBook, isLoading, error, currentChapterIndex } =
    readerStore();

  const totalChapters = parsedBook?.chapters.length ?? 0;
  const progressPercent =
    totalChapters > 0
      ? Math.round(((currentChapterIndex + 1) / totalChapters) * 100)
      : 0;

  const toc = parsedBook?.toc ?? [];

  useEffect(() => {
    if (!bookId) return;

    void loadReaderBook(bookId).catch(() => {
      // errors are already captured in store.error by loadReaderBook
    });

    return () => {
      readerStore.getState().reset();
    };
  }, [bookId]);

  useReaderEngine({
    iframeRef,
    parsedBook,
    bookId,
    initialProgress: readerDocument?.book.progress ?? null,
  });

  const handleTocItemClick = useCallback(
    (item: TocItem) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentDocument || !iframe.contentWindow || !parsedBook) {
        return;
      }
      setTocOpen(false);
      jumpToTocItem(
        item,
        iframe.contentDocument,
        iframe.contentWindow,
        parsedBook.chapters,
      );
    },
    [parsedBook],
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center surface text-primary">
        <p>Loading reader...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center surface text-primary">
        <div className="text-center">
          <p className="mb-2 font-semibold">Error loading book</p>
          <p className="text-secondary text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!readerDocument || !parsedBook) {
    return (
      <div className="flex h-screen items-center justify-center surface text-primary">
        <p>No book loaded</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col surface relative overflow-hidden">
      {/* Header */}
      <header className="folio-header flex items-center justify-between px-(--margin-mobile)">
        <button
          className="text-primary hover:opacity-70 transition-opacity"
          aria-label="Go back"
          onClick={() => navigate(-1)}
        >
          <BackIcon />
        </button>

        <div className="flex flex-col items-center gap-1">
          <h1 className="text-xl font-semibold">{readerDocument.book.title}</h1>
          <p className="text-sm text-stone-600">{readerDocument.book.author}</p>
        </div>

        <div className="w-5" />
      </header>

      {/* Reader Content */}
      <main className="flex-1 overflow-hidden flex flex-col px-2">
        <ReaderFrame ref={iframeRef} />
      </main>

      {/* Footer */}
      <footer className="folio-header border-t border-divider px-(--margin-mobile) py-4 flex flex-col gap-3">
        {/* Progress bar */}
        <div className="relative w-full h-0.5 bg-border rounded-full">
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-accent rounded-full shadow-sm"
            style={{ left: `${progressPercent}%` }}
            aria-hidden="true"
          />
          <div
            className="absolute top-0 left-0 h-full bg-accent"
            style={{ width: `${progressPercent}%` }}
            aria-hidden="true"
          />
          <span className="absolute right-0 top-0 text-[10px] text-secondary font-ui">
            {progressPercent}%
          </span>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            className="text-primary hover:opacity-70 transition-opacity disabled:opacity-30"
            aria-label="Table of contents"
            disabled={toc.length === 0}
            onClick={() => setTocOpen(true)}
          >
            <TocIcon />
          </button>
          <span className="metadata">
            {readerDocument.book.title} • Chapter{" "}
            {totalChapters > 0 ? currentChapterIndex + 1 : "–"}
            {totalChapters > 0 ? ` of ${totalChapters}` : ""}
          </span>
          <div className="w-5" />
        </div>
      </footer>

      {/* TOC Drawer */}
      {tocOpen && (
        <TocDrawer
          toc={toc}
          currentChapterIndex={currentChapterIndex}
          onItemClick={handleTocItemClick}
          onClose={() => setTocOpen(false)}
        />
      )}
    </div>
  );
};
