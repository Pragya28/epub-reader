import type { FC } from "react";
import type { BookWithProgress } from "../../types/library.types";
import { BookCover } from "./book-cover";
import { ThreeVerticalDots } from "@/assets/icons";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/shared/utils/routes";

interface BookCardProps {
  book: BookWithProgress;
  index: number;
}

export const BookCard: FC<BookCardProps> = ({ book, index }) => {
  const navigate = useNavigate();

  const isFinished = book.status === "finished";
  const isReading = book.status === "reading";

  return (
    <div
      className="flex flex-col gap-2.5"
      onClick={() => navigate(ROUTES.READER.replace(":bookId", book.id))}
    >
      <div className="relative w-full rounded-xl overflow-hidden shadow-[0 4px 16px rgba(20,16,8,0.22)] aspect-2/3">
        <BookCover book={book} index={index} />

        {book.isNew && (
          <div className="absolute top-0 right-0 bg-white/95 text-[#1a1610] text-[10px] font-bold uppercase tracking-[0.8px] px-2.5 py-1 rounded-bl-xl">
            NEW
          </div>
        )}
      </div>

      {/* Meta below cover */}
      <div className="flex flex-col gap-0.5 pr-1">
        {/* Title row */}
        <div className="flex items-start justify-between gap-0.5">
          <div
            className={[
              "flex-1 min-w-0 font-bold text-ui leading-tight text-primary",
              isFinished ? "line-through opacity-50" : "",
            ].join(" ")}
          >
            {book.title}
          </div>
          <button
            aria-label="More options"
            className="shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center bg-transparent border-none cursor-pointer text-secondary opacity-70 hover:opacity-100 transition-opacity"
          >
            <ThreeVerticalDots />
          </button>
        </div>

        {/* Author */}
        {book.author && (
          <p className="text-ui-sm text-secondary leading-snug">
            {book.author}
          </p>
        )}

        {/* Reading progress text */}
        {isReading && book.progress !== undefined && (
          <p className="text-meta text-secondary mt-0.5">
            {book.progress}% read
          </p>
        )}

        {isFinished && (
          <p className="text-meta text-secondary mt-0.5">Finished</p>
        )}
      </div>
    </div>
  );
};
