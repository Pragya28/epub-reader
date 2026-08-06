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
      ? `${book.chapterIndex + 1} of ${book.totalChapters}`
      : "1";

  return (
    <button
      onClick={() => navigate(ROUTES.READER.replace(":bookId", book.id))}
      aria-label={`Continue reading ${book.title}`}
      className="fixed bottom-5 left-2 right-20 flex items-center gap-2 p-2 rounded-2xl border-none cursor-pointer text-left opacity-90 transition-opacity hover:opacity-100 active:opacity-100 z-40 bg-warm-accent shadow-(--shadow-floating)"
    >
      {/* Book icon in a subtle tile atop the banner's own tone */}
      <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-warm-accent-foreground/10 text-warm-accent-foreground">
        <BookOpen />
      </div>

      {/* Text block */}
      <div className="flex flex-col flex-1 min-w-0 gap-1">
        <p className="text-meta font-semibold uppercase tracking-[0.14em] text-warm-accent-foreground/80 leading-none mb-1 font-reading">
          Continue Reading
        </p>
        <p className="text-title-sm font-semibold text-warm-accent-foreground leading-snug truncate">
          {book.title}
        </p>
        {/* Sub-line: chapter + progress bar */}
        <div className="mt-1.5 flex flex-row items-center gap-2">
          <Progress
            value={book.progress ?? 0}
            className="flex-1"
            trackClassName="bg-warm-accent-foreground/20"
            indicatorClassName="bg-warm-accent-foreground"
          />
          <span className="shrink-0 whitespace-nowrap text-meta text-warm-accent-foreground/70">
            {chapter} · {book.progress ?? 0}%
          </span>
        </div>
      </div>

      {/* Chevron */}
      <div className="shrink-0 text-warm-accent-foreground/70">
        <ChevronRight size={36} strokeWidth={1.5} />
      </div>
    </button>
  );
};
