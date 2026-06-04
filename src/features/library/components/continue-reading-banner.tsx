import type { FC } from "react";
import type { BookWithProgress } from "../types/library.types";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/shared/utils/routes";
import { ChevronRightIcon, OpenBookIcon } from "@/assets/icons";

interface ContinueReadingBannerProps {
  book: BookWithProgress;
}

export const ContinueReadingBanner: FC<ContinueReadingBannerProps> = ({
  book,
}) => {
  const navigate = useNavigate();

  const chapter = book.progress
    ? `Chapter ${Math.ceil((book.progress / 100) * 12)}`
    : "Chapter I";

  return (
    <button
      onClick={() => navigate(ROUTES.READER.replace(":bookId", book.id))}
      aria-label={`Continue reading ${book.title}`}
      className="fixed bottom-5 left-2 right-15 flex items-center gap-2 p-2 rounded-2xl border-none cursor-pointer text-left transition-opacity hover:opacity-95 active:opacity-80 z-40 bg-text-primary shadow-(--shadow-floating)"
    >
      {/* Book icon in a dark tile */}
      <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-(--cover-dark) text-(--cover-gold)">
        <OpenBookIcon />
      </div>

      {/* Text block */}
      <div className="flex flex-col flex-1 min-w-0 gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-(--cover-gold) leading-none mb-1 font-reading">
          Continue Reading
        </p>
        <p className="text-[15px] font-semibold text-white leading-snug truncate">
          {book.title}
        </p>
        {/* Sub-line: chapter + progress bar */}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-0.5 rounded-full overflow-hidden bg-[#3d342a]">
            <div
              className="h-full rounded-full bg-(--cover-gold)"
              style={{ width: `${book.progress ?? 0}%` }}
            />
          </div>
          <span className="text-[10px] text-[#6b5e4e] whitespace-nowrap shrink-0">
            {chapter} · {book.progress ?? 0}%
          </span>
        </div>
      </div>

      {/* Chevron */}
      <div className="shrink-0 text-[#6b5e4e]">
        <ChevronRightIcon />
      </div>
    </button>
  );
};
