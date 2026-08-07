import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "@/utils/routes";
import { getBookCoverUrl } from "@/services/storage/book-repository";
import type { TocItem } from "@/services/epub/epub-types";
import { loadReaderBook } from "../actions/load-reader-book";
import { jumpToTocItem } from "../actions/jump-to-toc-item";
import { readerStore } from "../store/reader-store";
import { useReaderEngine } from "./use-reader-engine";
import { useChromeVisibility } from "@/shared/hooks/use-chrome-visibility";

/**
 * All non-visual state behind ReaderScreen: loading the book and its cover,
 * cleanup on unmount, chapter navigation, and the external-link confirmation
 * flow. Kept separate from ReaderScreen so that component stays
 * presentational, matching useLibraryScreen on the library side.
 */
export function useReaderScreen() {
  const navigate = useNavigate();
  const { bookId } = useParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
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

    void loadReaderBook(bookId).catch(() => {
      // errors are already captured in store.error by loadReaderBook
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
    initialProgress: readerDocument?.book.progress ?? null,
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
