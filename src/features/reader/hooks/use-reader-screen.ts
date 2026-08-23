import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "@/utils/routes";
import { getBookCoverUrl } from "@/services/storage/book-repository";
import { getNextInSeries } from "@/services/storage/groupings";
import { enrichBookWithProgress } from "@/features/library/utils/derive-book-status";
import type { BookWithProgress } from "@/features/library/types/library.types";
import type { TocItem } from "@/services/epub/epub-types";
import { loadReaderBook } from "../actions/load-reader-book";
import { jumpToTocItem } from "../actions/jump-to-toc-item";
import { readerStore } from "../store/reader-store";
import { useReaderEngine } from "./use-reader-engine";
import { useChromeVisibility } from "@/shared/hooks/use-chrome-visibility";

/** Mirrors derive-book-status.ts's FINISHED_SCROLL_FRACTION_THRESHOLD (0.98),
 * on the 0-100 percent scale progressPercent already uses. */
const FINISHED_PROGRESS_PERCENT_THRESHOLD = 98;

/**
 * All non-visual state behind ReaderScreen: loading the book and its cover,
 * cleanup on unmount, chapter navigation, and the external-link confirmation
 * flow. Kept separate from ReaderScreen so that component stays
 * presentational, matching useLibraryScreen on the library side.
 */
interface SearchJumpState {
  searchJump?: { chapterIndex: number; word: string };
}

export function useReaderScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { bookId } = useParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const searchJump = (location.state as SearchJumpState | null)?.searchJump;
  const [pendingExternalHref, setPendingExternalHref] = useState<string | null>(
    null,
  );

  const {
    readerDocument,
    parsedBook,
    isLoading,
    error,
    currentChapterIndex,
    progressPercent,
  } = readerStore();
  const hasFootnoteBackPosition = readerStore(
    (state) => state.footnoteBackStack.length > 0,
  );
  const isJumping = readerStore((state) => state.isJumping);

  const totalChapters = parsedBook?.chapters.length ?? 0;
  const toc = parsedBook?.toc ?? [];

  // "Next in series" banner: fires once the reader reaches the book's
  // literal end this session, same threshold the library uses to mark a
  // book "finished" (derive-book-status.ts), reusing getNextInSeries
  // (Sprint 7 Day 4 item 15) rather than a second detection mechanism.
  const isBookFinished =
    totalChapters > 0 &&
    currentChapterIndex >= totalChapters - 1 &&
    progressPercent >= FINISHED_PROGRESS_PERCENT_THRESHOLD;
  const [nextBook, setNextBook] = useState<BookWithProgress | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveNextBook() {
      const book = readerDocument?.book;
      if (
        !isBookFinished ||
        !book?.seriesGroupingId ||
        book.seriesIndex === undefined
      ) {
        return;
      }

      const next = await getNextInSeries(
        book.seriesGroupingId,
        book.seriesIndex,
      );
      if (!cancelled) setNextBook(next ? enrichBookWithProgress(next) : null);
    }

    void resolveNextBook();
    return () => {
      cancelled = true;
    };
  }, [isBookFinished, readerDocument?.book]);

  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined);
  const [coverChecked, setCoverChecked] = useState(false);

  useEffect(() => {
    if (!bookId) return;

    let cancelled = false;
    void getBookCoverUrl(bookId).then((url) => {
      if (cancelled) return;
      setCoverUrl(url);
      setCoverChecked(true);
    });

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    if (!bookId) return;

    void loadReaderBook(bookId, searchJump?.chapterIndex)
      .then(() => setNextBook(null))
      .catch(() => {
        // errors are already captured in store.error by loadReaderBook
        setNextBook(null);
      });

    return () => {
      // Revoke all chapter asset blob URLs (images, fonts) before clearing
      // the store. Without this, every asset in the full book accumulates as
      // leaked object URLs for the lifetime of the browser tab.
      const { parsedBook } = readerStore.getState();
      if (parsedBook) {
        for (const chapter of parsedBook.chapters) {
          for (const blobUrl of chapter.assetMap.values()) {
            URL.revokeObjectURL(blobUrl);
          }
        }
      }
      readerStore.getState().reset();
    };
    // searchJump intentionally excluded: a jump to a different chapter of a
    // different book always arrives together with a bookId change (this
    // effect's only real trigger), so re-running on searchJump alone would
    // just re-fire the same load for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const handleTocItemClick = useCallback(
    (item: TocItem) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentDocument || !iframe.contentWindow || !parsedBook) {
        return;
      }
      void jumpToTocItem(
        item,
        iframe.contentDocument,
        iframe.contentWindow,
        parsedBook,
      );
    },
    [parsedBook],
  );

  const handleChapterNav = useCallback(
    (direction: 1 | -1) => {
      // Read the live store value rather than the closed-over currentChapterIndex —
      // a second click before React re-renders would otherwise recompute the same
      // target as the first, silently dropping the increment.
      handleTocItemClick({
        label: "",
        href: "",
        chapterIndex: readerStore.getState().currentChapterIndex + direction,
        children: [],
      });
    },
    [handleTocItemClick],
  );

  // Destructured (not kept as one `chrome` object) — useChromeVisibility returns
  // a fresh object every render, so referencing the whole object anywhere
  // deps-tracked (like handleExternalLink below) would give that callback a
  // new identity every render too, re-triggering useReaderEngine's effect
  // (which depends on onExternalLink) on every render and repeatedly
  // wiping/remounting the reader iframe. The individual functions themselves
  // are stable across renders.
  const {
    visible: chromeVisible,
    handleScroll: handleChromeScroll,
    toggle: toggleChrome,
    setOverlay: setChromeOverlay,
    reveal: revealChrome,
  } = useChromeVisibility();

  const handleExternalLink = useCallback(
    (href: string) => {
      setChromeOverlay(true);
      setPendingExternalHref(href);
    },
    [setChromeOverlay],
  );

  const { jumpBack } = useReaderEngine({
    iframeRef,
    parsedBook,
    bookId,
    chapterWordCounts: readerDocument?.book.chapterWordCounts,
    initialProgress: readerDocument?.book.progress ?? null,
    searchJump,
    onExternalLink: handleExternalLink,
    onScrollPosition: handleChromeScroll,
    onContentTap: toggleChrome,
  });

  const confirmExternalLink = () => {
    if (!pendingExternalHref) return;
    window.open(pendingExternalHref, "_blank", "noopener,noreferrer");
    setPendingExternalHref(null);
    setChromeOverlay(false);
  };

  return {
    bookId,
    iframeRef,

    readerDocument,
    parsedBook,
    isLoading,
    error,
    currentChapterIndex,
    progressPercent,
    hasFootnoteBackPosition,
    isJumping,
    totalChapters,
    toc,

    nextBook,

    coverUrl,
    coverChecked,

    pendingExternalHref,
    setPendingExternalHref,
    confirmExternalLink,

    chromeVisible,
    setChromeOverlay,
    revealChrome,

    handleTocItemClick,
    handleChapterNav,
    jumpBack,

    goBack: () => navigate(-1),
    goToLibrary: () => navigate(ROUTES.LIBRARY),
    retryLoad: () => {
      if (bookId) void loadReaderBook(bookId);
    },
  };
}
