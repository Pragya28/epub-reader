import { useEffect, useRef, type FC } from "react";
import { useParams } from "react-router-dom";

import { loadReaderBook } from "@/features/reader/actions/load-reader-book";
import { ReaderFrame } from "@/features/reader/components/reader-frame";
import { useReaderEngine } from "@/features/reader/hooks/use-reader-engine";
import { readerStore } from "@/features/reader/store/reader-store";

export const ReaderScreen: FC = () => {
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
    return <div>Loading reader...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!readerDocument || !parsedBook) {
    return <div>No book loaded</div>;
  }

  return (
    <div className="flex h-screen flex-col surface text-primary">
      <header className="border-b border-stone-200 p-4">
        <h1 className="text-xl font-semibold">{readerDocument.book.title}</h1>

        <p className="text-sm text-stone-600">{readerDocument.book.author}</p>
      </header>

      <main className="flex-1 overflow-hidden">
        <ReaderFrame ref={iframeRef} />
      </main>
    </div>
  );
};
