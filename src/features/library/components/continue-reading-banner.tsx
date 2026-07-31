import type { FC } from "react";
import type { BookWithProgress } from "../types/library.types";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/utils/routes";
import { Progress } from "@/components/ui/progress";
import { BookOpen, ChevronRight } from "lucide-react";

interface ContinueReadingBannerProps {
  book: BookWithProgress;
}

export const ContinueReadingBanner: FC<ContinueReadingBannerProps> = ({
  book,
}) => {
  const navigate = useNavigate();

  const chapter =
    book.chapterIndex !== undefined && book.totalChapters
      ? `Chapter ${book.chapterIndex + 1} of ${book.totalChapters}`
      : "Chapter I";

  return (
    <button
      onClick={() => navigate(ROUTES.READER.replace(":bookId", book.id))}
      aria-label={`Continue reading ${book.title}`}
      className="fixed bottom-5 left-2 right-20 flex items-center gap-2 p-2 rounded-2xl border-none cursor-pointer text-left transition-opacity hover:opacity-95 active:opacity-80 z-40 bg-foreground shadow-(--shadow-floating)"
    >
      {/* Book icon in a dark tile */}
      <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-cover-dark text-cover-gold">
        <BookOpen />
      </div>

      {/* Text block */}
      <div className="flex flex-col flex-1 min-w-0 gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cover-gold leading-none mb-1 font-reading">
          Continue Reading
        </p>
        <p className="text-[15px] font-semibold text-background leading-snug truncate">
          {book.title}
        </p>
        {/* Sub-line: chapter + progress bar */}
        <div className="mt-1.5 flex items-center gap-2">
          <Progress value={book.progress ?? 0} className="flex-1" />
          <span className="shrink-0 whitespace-nowrap text-[10px] text-background/60">
            {chapter} · {book.progress ?? 0}%
          </span>
        </div>
      </div>

      {/* Chevron */}
      <div className="shrink-0 text-background/60">
        <ChevronRight size={36} strokeWidth={1.5} />
      </div>
    </button>
  );
};
