import type { FC } from "react";
import type { BookWithProgress } from "../types/library.types";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/utils/routes";
import { Progress } from "@/components/ui/progress";
import { BookOpen, ChevronRight } from "lucide-react";

interface ContinueReadingBannerProps {
  book: BookWithProgress;
  /**
   * Caption shown above the title (e.g. "Next book") and folded into the
   * aria-label in place of "Continue reading" — used by the "next in
   * series" variant of this same banner. Omitted for the default
   * continue-reading case, which reads as it always has.
   */
  label?: string;
}

export const ContinueReadingBanner: FC<ContinueReadingBannerProps> = ({
  book,
  label,
}) => {
  const navigate = useNavigate();

  const chapter =
    book.chapterIndex !== undefined && book.totalChapters
      ? `${book.chapterIndex + 1} of ${book.totalChapters}`
      : "1";

  return (
    <button
      onClick={() => navigate(ROUTES.READER.replace(":bookId", book.id))}
      aria-label={`${label ?? "Continue reading"} ${book.title}`}
      className="fixed bottom-5 left-2 right-[60px] flex items-center gap-2 py-1.5 pl-1.5 pr-2 rounded-xl border-none cursor-pointer text-left opacity-90 transition-opacity hover:opacity-100 active:opacity-100 z-40 bg-popover text-popover-foreground ring-1 ring-foreground/10 shadow-(--shadow-floating)"
    >
      {/* Book icon in a subtle tile atop the banner's own tone */}
      <div className="shrink-0 size-9 rounded-lg flex items-center justify-center bg-popover-foreground/10 text-popover-foreground">
        <BookOpen size={18} />
      </div>

      {/* Text block: optional caption + title + inline progress. The
          default (no label) case is unchanged — just title + progress
          row, the icon/chevron already carry "continue reading" and the
          aria-label covers it for a11y. */}
      <div className="flex flex-col flex-1 min-w-0 gap-1">
        {label && (
          <p className="text-meta text-popover-foreground/70 leading-none">
            {label}
          </p>
        )}
        <p className="text-ui-sm font-semibold text-popover-foreground leading-tight truncate">
          {book.title}
        </p>
        <div className="flex flex-row items-center gap-1.5">
          <Progress
            value={book.progress ?? 0}
            className="flex-1 h-1"
            trackClassName="bg-popover-foreground/20"
            indicatorClassName="bg-popover-foreground"
          />
          <span className="shrink-0 whitespace-nowrap text-meta text-popover-foreground/90">
            {chapter} · {book.progress ?? 0}%
          </span>
        </div>
      </div>

      {/* Chevron */}
      <div className="shrink-0 text-popover-foreground/70">
        <ChevronRight size={20} strokeWidth={1.5} />
      </div>
    </button>
  );
};
