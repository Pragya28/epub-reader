import { useEffect, useRef, type FC } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { loadReaderBook } from "@/features/reader/actions/load-reader-book";
import { ReaderFrame } from "@/features/reader/components/reader-frame";
import { useReaderEngine } from "@/features/reader/hooks/use-reader-engine";
import { readerStore } from "@/features/reader/store/reader-store";
import { BackIcon } from "@/assets/icons";

export const ReaderScreen: FC = () => {
  const navigate = useNavigate();
  const { bookId } = useParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { readerDocument, parsedBook, isLoading, error } = readerStore();

  useEffect(() => {
    if (!bookId) {
      return;
    }

    void loadReaderBook(bookId).catch(() => {
      // errors are already captured in store.error by loadReaderBook
    });

    return () => {
      readerStore.getState().reset();
    };
  }, [bookId]);

  useReaderEngine({ iframeRef, parsedBook });

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
    <div className="flex h-screen flex-col surface">
      {/* Header */}
      <header className="folio-header flex items-center justify-between px-(--margin-mobile)">
        <button
          className="text-primary hover:opacity-70 transition-opacity"
          aria-label="Go back"
        >
          <span onClick={() => navigate(-1)} className="cursor-pointer">
            <BackIcon />
          </span>
        </button>

        <div className="flex flex-col items-center gap-1">
          <h1 className="text-xl font-semibold">{readerDocument.book.title}</h1>
          <p className="text-sm text-stone-600">{readerDocument.book.author}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* <button
            className="text-primary hover:opacity-70 transition-opacity"
            aria-label="Adjust text size"
          >
            <span className="material-symbols-outlined">format_size</span>
          </button>
          <button
            className="text-primary hover:opacity-70 transition-opacity"
            aria-label="Bookmark"
          >
            <span className="material-symbols-outlined">bookmark_border</span>
          </button> */}
        </div>
      </header>

      {/* Reader Content */}
      <main className="flex-1 overflow-hidden flex flex-col px-2">
        <ReaderFrame ref={iframeRef} />
      </main>

      {/* Footer */}
      <footer className="folio-header border-t border-divider px-(--margin-mobile) py-4 flex flex-col gap-3">
        {/* Progress bar */}
        <div className="relative w-full h-[2px] bg-border rounded-full">
          <div
            className="absolute top-1/2 left-[12%] -translate-y-1/2 w-3 h-3 bg-accent rounded-full shadow-sm"
            aria-hidden="true"
          ></div>
          <div
            className="absolute top-0 left-0 h-full bg-accent w-[12%]"
            aria-hidden="true"
          ></div>
          <span className="absolute right-0 -top-6 text-[10px] text-secondary font-ui">
            12%
          </span>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            className="text-primary hover:opacity-70 transition-opacity"
            aria-label="Table of contents"
          >
            <span className="material-symbols-outlined">list</span>
          </button>
          <span className="metadata">
            {readerDocument.book.title} • Chapter 1
          </span>
          <div className="w-5"></div>
        </div>
      </footer>
    </div>
  );
};
