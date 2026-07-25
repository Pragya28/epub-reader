import { ROUTES } from "@/utils/routes";
import { useEffect, type FC } from "react";
import { Link } from "react-router-dom";
import { libraryStore } from "@/features/library/store/library-store";
import { loadLibrary } from "@/features/library/actions/load-library";
import { enrichBookWithProgress } from "@/features/library/utils/derive-book-status";
import { BookGrid } from "@/features/library/components/book-grid";
import { ContinueReadingBanner } from "@/features/library/components/continue-reading-banner";
import { ImportBookButton } from "@/features/library/components/import-book-button";
import { Search, Settings, SlidersHorizontal } from "lucide-react";
import { toastStore } from "@/stores/toast-store";
import { WordMark } from "@/assets/word-mark";

export const LibraryScreen: FC = () => {
  const { books, isLoading, error } = libraryStore();

  useEffect(() => {
    void loadLibrary();
  }, []);

  const enriched = books.map(enrichBookWithProgress);

  const ordered = [
    ...enriched.filter((book) => !book.isFinished),
    ...enriched.filter((book) => book.isFinished),
  ];

  // Most recently read book still in progress — real data from
  // book.progress.updatedAt, not just "the first 'reading' book found".
  const currentBook =
    [...ordered]
      .filter((b) => b.isReading)
      .sort(
        (a, b) => (b.progressUpdatedAt ?? 0) - (a.progressUpdatedAt ?? 0),
      )[0] ?? null;

  useEffect(() => {
    if (error) {
      toastStore.getState().showError(error);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="folio-header sticky top-0 z-50 px-5 flex items-center">
        <WordMark className="mr-auto h-16 w-auto" />
        <nav className="flex items-center gap-1 text-foreground">
          <button
            aria-label="Search"
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:surface-container transition-colors border-none bg-transparent cursor-pointer"
          >
            <Search strokeWidth={1.5} />
          </button>
          <button
            aria-label="Filter"
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:surface-container transition-colors border-none bg-transparent cursor-pointer"
          >
            <SlidersHorizontal strokeWidth={1.5} />
          </button>
          <Link
            to={ROUTES.SETTINGS}
            aria-label="Settings"
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:surface-container transition-colors text-primary"
          >
            <Settings strokeWidth={1.5} />
          </Link>
        </nav>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      {/* Extra bottom padding keeps content clear of the fixed bottom bar */}
      <main className="flex-1 px-4 pt-5 pb-36">
        <div className="text-[22px] font-heading font-semibold text-foreground mb-5 leading-tight">
          Your Personal Collection
        </div>
        <BookGrid isLoading={isLoading} isSearch={false} books={ordered} />
      </main>

      {/* ── Continue Reading — fixed, fills width minus FAB ─────────────── */}
      {currentBook && <ContinueReadingBanner book={currentBook} />}

      {/* ── FAB — fixed bottom-right ─────────────────────────────────────── */}
      <ImportBookButton />
    </div>
  );
};
