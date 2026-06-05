import { loadReaderBook } from "@/features/reader/actions/load-reader-book";
import { readerStore } from "@/features/reader/store/reader-store";
import { useEffect, type FC } from "react";
import { useParams } from "react-router-dom";

export const ReaderScreen: FC = () => {
  const { bookId } = useParams();

  const { document, isLoading, error, setDocument, setLoading, setError } =
    readerStore();

  useEffect(() => {
    if (!bookId) return;

    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        if (!bookId) return;
        const book = await loadReaderBook(bookId);

        if (!mounted) return;

        setDocument(book);
      } catch (err) {
        if (!mounted) return;

        setError(err instanceof Error ? err.message : "Failed to load book");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [bookId, setDocument, setLoading, setError]);

  if (isLoading) {
    return <div>Loading reader...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!document) {
    return <div>No book loaded</div>;
  }

  return (
    <div className="min-h-screen surface text-primary">
      <header className="border-b border-stone-200 p-4">
        <h1 className="text-xl font-semibold">{document.book.title}</h1>
        <p className="text-sm text-stone-600">{document.book.author}</p>
      </header>

      <main className="mx-auto max-w-3xl p-6">
        Reader engine starts tomorrow.
      </main>
    </div>
  );
};
