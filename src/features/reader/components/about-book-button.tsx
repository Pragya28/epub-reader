import { useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { InfoIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { AboutBookSheet } from "@/features/library/components/about-book-sheet";
import { enrichBookWithProgress } from "@/features/library/utils/derive-book-status";
import { libraryStore } from "@/features/library/store/library-store";
import { ROUTES } from "@/utils/routes";
import type { StoredBook } from "@/services/storage/storage-types";

interface AboutBookButtonProps {
  book: StoredBook;
  /** Already-resolved cover object URL (the reader screen fetches its own,
   * via getBookCoverUrl) — passed straight through rather than refetched,
   * since enrichBookWithProgress doesn't set coverBg itself (only
   * load-library.ts's booksWithProgress mapping does, for the grid). */
  coverUrl?: string;
  onOpenChange?: (open: boolean) => void;
}

/** Header trigger for the reader's "About this book" sheet. Reuses the
 * library's AboutBookSheet (cover, title/author, progress, reading time,
 * description, "More by Author") rather than a second bespoke panel. */
export const AboutBookButton: FC<AboutBookButtonProps> = ({
  book,
  coverUrl,
  onOpenChange,
}) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Same "more than one book by this author/series" checks use-book-card.ts
  // does for the library grid's own About sheet.
  const hasMoreByAuthor = libraryStore(
    (state) =>
      !!book.author &&
      state.books.filter((b) => b.author === book.author).length > 1,
  );
  const seriesBookCount = libraryStore((state) =>
    book.seriesName
      ? state.books.filter((b) => b.seriesName === book.seriesName).length
      : 0,
  );
  const hasSeriesLink = seriesBookCount > 1 && !!book.seriesGroupingId;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="About this book"
        onClick={() => handleOpenChange(true)}
      >
        <InfoIcon className="size-5" weight="light" />
      </Button>

      <AboutBookSheet
        book={{ ...enrichBookWithProgress(book), coverBg: coverUrl }}
        open={open}
        onOpenChange={handleOpenChange}
        hasMoreByAuthor={hasMoreByAuthor}
        onMoreByAuthor={() =>
          navigate(
            ROUTES.LIBRARY_AUTHOR.replace(
              ":author",
              encodeURIComponent(book.author!),
            ),
          )
        }
        hasSeriesLink={hasSeriesLink}
        seriesBookCount={seriesBookCount}
        onViewSeries={() =>
          navigate(
            ROUTES.LIBRARY_SERIES.replace(
              ":groupingId",
              book.seriesGroupingId!,
            ),
          )
        }
      />
    </>
  );
};
