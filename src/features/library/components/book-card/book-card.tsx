import type { FC } from "react";
import type { BookWithProgress } from "../../types/library.types";
import { BookCover } from "./book-cover";
import { ThreeVerticalDots } from "@/assets/icons";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/shared/utils/routes";

export const BookCard: FC<BookWithProgress> = (book) => {
  const { status, id, isNew, author, title, progress } = book;
  const navigate = useNavigate();

  const isFinished = status === "finished";
  const isReading = status === "reading";

  return (
    <div
      className="flex flex-col gap-2.5"
      onClick={() => navigate(ROUTES.READER.replace(":bookId", id))}
    >
      <div className="relative w-full rounded-xl overflow-hidden aspect-2/3 border border-border/40 shadow-[0_4px_16px_rgba(20,16,8,0.22)]">
        <BookCover {...book} />

        {isNew && (
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
            {title}
          </div>
          <button
            aria-label="More options"
            className="shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center bg-transparent border-none cursor-pointer text-secondary opacity-70 hover:opacity-100 transition-opacity"
          >
            <ThreeVerticalDots />
          </button>
        </div>

        {/* Author */}
        {author && (
          <p className="text-ui-sm text-secondary leading-snug">{author}</p>
        )}

        {/* Reading progress text */}
        {isReading && progress !== undefined && (
          <p className="text-meta text-secondary mt-0.5">{progress}% read</p>
        )}

        {isFinished && (
          <p className="text-meta text-secondary mt-0.5">Finished</p>
        )}
      </div>
    </div>
  );
};
