import { ROUTES } from "@/utils/routes";
import { useEffect, useState, type FC } from "react";
import { Link } from "react-router-dom";
import { libraryStore } from "@/features/library/store/library-store";
import { loadLibrary } from "@/features/library/actions/load-library";
import { enrichBookWithProgress } from "@/features/library/utils/derive-book-status";
import WordIcon from "@/assets/images/word-icon.png";
import { BookGrid } from "@/features/library/components/book-grid";
import { ContinueReadingBanner } from "@/features/library/components/continue-reading-banner";
import { ImportBookButton } from "@/features/library/components/import-book-button";
import { FilterIcon, SearchIcon, SettingsIcon } from "@/assets/icons";
import { toastStore } from "@/stores/toast-store";

export const LibraryScreen: FC = () => {
  const [search, setSearch] = useState("");
  const { books, isLoading, error } = libraryStore();

  useEffect(() => {
    void loadLibrary();
  }, []);

  const enriched = books.map(enrichBookWithProgress);
  const filtered = search.trim()
    ? enriched.filter(
        (b) =>
          b.title.toLowerCase().includes(search.toLowerCase()) ||
          (b.author ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : enriched;

  // Most recently read book still in progress — real data from
  // book.progress.updatedAt, not just "the first 'reading' book found".
  const currentBook =
    [...enriched]
      .filter((b) => b.status === "reading")
      .sort(
        (a, b) => (b.progressUpdatedAt ?? 0) - (a.progressUpdatedAt ?? 0),
      )[0] ?? null;

  useEffect(() => {
    if (error) {
      toastStore.getState().showError(error);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col surface font-ui">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="folio-header sticky top-0 z-50 px-5 flex items-center">
        <div className="flex-1">
          <img
            src={WordIcon}
            alt="Librune"
            className="h-8 sm:h-10 md:h-12 w-auto"
          />
        </div>
        <nav className="flex items-center gap-1 text-primary">
          <button
            aria-label="Search"
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:surface-container transition-colors border-none bg-transparent cursor-pointer"
          >
            <SearchIcon />
          </button>
          <button
            aria-label="Filter"
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:surface-container transition-colors border-none bg-transparent cursor-pointer"
          >
            <FilterIcon />
          </button>
          <Link
            to={ROUTES.SETTINGS}
            aria-label="Settings"
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:surface-container transition-colors text-primary"
          >
            <SettingsIcon />
          </Link>
        </nav>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      {/* Extra bottom padding keeps content clear of the fixed bottom bar */}
      <main className="flex-1 px-4 pt-5 pb-36">
        <div className="text-[22px] font-display font-semibold text-primary mb-5 leading-tight">
          Your Personal Collection
        </div>

        <BookGrid
          isLoading={isLoading}
          isSearch={search.length !== 0}
          books={filtered}
        />
      </main>

      {/* ── Continue Reading — fixed, fills width minus FAB ─────────────── */}
      {currentBook && <ContinueReadingBanner book={currentBook} />}

      {/* ── FAB — fixed bottom-right ─────────────────────────────────────── */}
      <ImportBookButton />
    </div>
  );
};
