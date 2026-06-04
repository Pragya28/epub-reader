import type { StoredBook } from "@/services/storage/storage-types";
import { ROUTES } from "@/shared/utils/routes";
import { useEffect, useState, type FC } from "react";
import { Link } from "react-router-dom";
import { useLibraryStore } from "@/features/library/store/library-store";
import { loadLibrary } from "@/features/library/actions/load-library";
import type {
  BookWithProgress,
  ReadingStatus,
} from "@/features/library/types/library.types";
import WordIcon from "@/assets/images/word-icon.png";
import { BookGrid } from "@/features/library/components/book-grid";
import { ContinueReadingBanner } from "@/features/library/components/continue-reading-banner";
import { ImportBookButton } from "@/features/library/components/import-book-button";
import { FilterIcon, SearchIcon, SettingsIcon } from "@/assets/icons";

function enrichBooks(books: StoredBook[]): BookWithProgress[] {
  return books.map((b, i) => {
    const statusCycle: ReadingStatus[] = [
      "reading",
      "unread",
      "finished",
      "reading",
    ];
    const status = statusCycle[i % statusCycle.length];
    return {
      ...b,
      status,
      progress: status === "reading" ? [64, 38, 72, 55][i % 4] : undefined,
      isNew: status === "unread" && i % 2 === 1,
    };
  });
}

export const LibraryScreen: FC = () => {
  const [search, setSearch] = useState("");
  const books = useLibraryStore((state) => state.books);
  const isLoading = useLibraryStore((state) => state.isLoading);

  useEffect(() => {
    void loadLibrary();
  }, []);

  const enriched = enrichBooks(books);
  const filtered = search.trim()
    ? enriched.filter(
        (b) =>
          b.title.toLowerCase().includes(search.toLowerCase()) ||
          (b.author ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : enriched;

  const currentBook = enriched.find((b) => b.status === "reading") ?? null;

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
