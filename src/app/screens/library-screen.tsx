import { useEffect, type FC } from "react";
import { ImportBookButton } from "@/features/library/components/import-book-button";
import { useLibraryStore } from "@/features/library/store/library-store";
import { loadLibrary } from "@/features/library/actions/load-library";

export const LibraryScreen: FC = () => {
  const books = useLibraryStore((state) => state.books);

  const isLoading = useLibraryStore((state) => state.isLoading);

  const error = useLibraryStore((state) => state.error);

  useEffect(() => {
    void loadLibrary();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div>
      <h1>Library</h1>

      {books.length === 0 ? (
        <p>No books imported yet.</p>
      ) : (
        <ul>
          {books.map((book) => (
            <li key={book.id}>
              <strong>{book.title}</strong>

              {book.author && <span> — {book.author}</span>}
            </li>
          ))}
        </ul>
      )}

      <ImportBookButton />
    </div>
  );
};
