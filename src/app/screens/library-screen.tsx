import { ROUTES } from "@/utils/routes";
import { useEffect, type FC } from "react";
import { Link } from "react-router-dom";
import { libraryStore } from "@/features/library/store/library-store";
import { loadLibrary } from "@/features/library/actions/load-library";
import { enrichBookWithProgress } from "@/features/library/utils/derive-book-status";
import { BookGrid } from "@/features/library/components/book-grid";
import { ContinueReadingBanner } from "@/features/library/components/continue-reading-banner";
import { ImportBookFab } from "@/features/library/components/import-book-fab";
import { Search, Settings, SlidersHorizontal } from "lucide-react";
import { WordMark } from "@/assets/word-mark";
import { Button } from "@/components/ui/button";

export const LibraryScreen: FC = () => {
  const { books, isLoading } = libraryStore();

  useEffect(() => {
    void loadLibrary();

    // When the user navigates back from the reader, the reader's cleanup
    // flushes the final progress save to the DB. We listen for the page
    // becoming visible again so we re-fetch after that write has settled,
    // ensuring the progress bar and continue-reading banner reflect the
    // session that just ended.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadLibrary();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="folio-header sticky top-0 z-50 px-5 flex items-center">
        <WordMark className="mr-auto h-16 w-auto" />
        <nav className="flex items-center gap-1 text-foreground">
          <Button variant="ghost" size="icon" aria-label="Search">
            <Search strokeWidth={1.5} className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Filter">
            <SlidersHorizontal strokeWidth={1.5} className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            render={<Link to={ROUTES.SETTINGS} />}
          >
            <Settings strokeWidth={1.5} className="size-5" />
          </Button>
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
      <ImportBookFab />
    </div>
  );
};
