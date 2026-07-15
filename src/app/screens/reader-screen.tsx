import { useEffect, type FC } from "react";
import { useParams } from "react-router-dom";

import { loadReaderBook } from "@/features/reader/actions/load-reader-book";
import { ReaderFrame } from "@/features/reader/components/reader-frame";
import { readerStore } from "@/features/reader/store/reader-store";
import { EpubParser } from "@/services/epub/epub-parser";

export const ReaderScreen: FC = () => {
  const { bookId } = useParams();
  const parser = new EpubParser();

  const {
    readerDocument,
    parsedBook,
    isLoading,
    error,

    setReaderDocument,
    setParsedBook,
    setLoading,
    setError,
  } = readerStore();

  useEffect(() => {
    if (!bookId) {
      return;
    }

    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        if (!bookId) return null;
        const readerDocument = await loadReaderBook(bookId);

        const parsedBook = await parser.parseBook(readerDocument.file);

        if (!mounted) {
          return;
        }

        setReaderDocument(readerDocument);

        setParsedBook(parsedBook);
      } catch (err) {
        if (!mounted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to load book");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [bookId, setReaderDocument, setParsedBook, setLoading, setError]);

  if (isLoading) {
    return <div>Loading reader...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!readerDocument || !parsedBook) {
    return <div>No book loaded</div>;
  }

  const chapter = parsedBook.chapters[0];

  return (
    <div className="flex h-screen flex-col surface text-primary">
      <header className="border-b border-stone-200 p-4">
        <h1 className="text-xl font-semibold">{readerDocument.book.title}</h1>

        <p className="text-sm text-stone-600">{readerDocument.book.author}</p>
      </header>

      <main className="flex-1 overflow-hidden">
        <ReaderFrame chapterHtml={chapter} />
      </main>
    </div>
  );
};
