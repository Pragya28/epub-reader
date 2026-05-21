import { ImportBookButton } from "@/features/library/components/import-book-button";
import { getAllBooks } from "@/services/storage/book-repository";
import type { StoredBook } from "@/services/storage/storage-types";
import { useEffect, useState, type FC } from "react";

export const LibraryScreen: FC = () => {
  const [books, setBooks] = useState<StoredBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadBooks = async () => {
      try {
        const storedBooks = await getAllBooks();

        setBooks(storedBooks);
      } finally {
        setIsLoading(false);
      }
    };

    void loadBooks();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
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
      <ImportBookButton setBooks={setBooks} />
    </div>
  );
};
