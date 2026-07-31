import { useEffect, useMemo } from "react";
import type { RefObject } from "react";
import type { ParsedBook, ParsedChapter } from "@/services/epub/epub-types";
import { readerStore } from "../store/reader-store";
import { readerPreferencesStore } from "../store/reader-preferences-store";
import { ChapterLoader } from "../engine/loader/chapter-loader";
import { getChapterSections } from "../engine/scroll/get-chapter-sections";
import { detectVisibleChapter } from "../engine/scroll/detect-visible-chapter";
import { maintainChapterWindow } from "../engine/windowing/chapter-window";
import {
  initializeChapterDocument,
  mountChapter,
  mountChapterFallback,
} from "../engine/renderer/chapter-renderer";
import { applyReaderPreferences } from "../engine/renderer/iframe-renderer";
import { logger as rootLogger } from "@/shared/logger/logger";
import {
  computeReaderProgress,
  saveReaderProgress,
} from "../actions/save-reader-progress";
import type { ReadingProgress } from "@/services/storage/storage-types";
import { jumpToTocItem } from "../actions/jump-to-toc-item";

const SCROLL_PREFETCH_THRESHOLD_PX = 300;
const ENGINE_START_MAX_ATTEMPTS = 120;
const PROGRESS_SAVE_DEBOUNCE_MS = 1500;

const logger = rootLogger.child("reader-engine");

interface UseReaderEngineProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  parsedBook: ParsedBook | null;
  /** Book id to persist reading progress against. No-op when omitted. */
  bookId?: string;
  /** Position to restore on mount (from previously saved progress). */
  initialProgress?: ReadingProgress | null;
  /** Called when the reader taps an external link — caller handles confirmation UI. */
  onExternalLink?: (href: string) => void;
}

export function useReaderEngine({
  iframeRef,
  parsedBook,
  bookId,
  initialProgress,
  onExternalLink,
}: UseReaderEngineProps) {
  const chapterLoader = useMemo(() => new ChapterLoader(), []);

  useEffect(() => {
    const iframe = iframeRef.current;

    if (!iframe || !parsedBook) {
      logger.debug("effect skipped — missing iframe or parsedBook", {
        hasIframe: !!iframe,
        hasParsedBook: !!parsedBook,
      });
      return;
    }

    const chapters = parsedBook.chapters;
    const totalChapters = chapters.length;

    logger.info("effect starting", { totalChapters });

    let scrollCleanup: (() => void) | undefined;
    let preferenceCleanup: (() => void) | undefined;
    let cancelled = false;
    let restoredInitialPosition = false;
    let saveTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let lastComputedProgress: ReadingProgress | undefined;

    const flushPendingProgress = () => {
      if (saveTimeoutId) clearTimeout(saveTimeoutId);
      if (bookId && lastComputedProgress) {
        void saveReaderProgress(bookId, lastComputedProgress);
      }
    };

    // Backgrounding the app (home button, app switch, lock screen) never
    // unmounts this component — it just freezes JS execution. If a
    // debounced save was mid-flight at that moment, it would previously
    // be silently lost, and the next launch would restore an earlier,
    // stale position instead of wherever the user actually stopped
    // (this is what was causing books to get stuck below the "finished"
    // threshold despite actually being read to the end).
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        logger.info("page hidden — flushing pending progress save");
        flushPendingProgress();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushPendingProgress);

    const scheduleProgressSave = (progress: ReadingProgress) => {
      lastComputedProgress = progress;

      if (!bookId) return;

      if (saveTimeoutId) clearTimeout(saveTimeoutId);

      saveTimeoutId = setTimeout(() => {
        void saveReaderProgress(bookId, progress);
      }, PROGRESS_SAVE_DEBOUNCE_MS);
    };

    const startEngine = (iframeDoc: Document, win: Window) => {
      logger.info("startEngine — iframe document ready", {
        readyState: iframeDoc.readyState,
      });

      applyReaderPreferences(iframeDoc, readerPreferencesStore.getState());

      const unsubscribePreferences = readerPreferencesStore.subscribe(
        (preferences) => applyReaderPreferences(iframeDoc, preferences),
      );
      preferenceCleanup = unsubscribePreferences;

      const handleScroll = () => {
        const store = readerStore.getState();

        if (store.isJumping) return;

        const sections = getChapterSections(iframeDoc);
        if (sections.length === 0) return;

        const viewport = win.innerHeight;

        const activeIndex = detectVisibleChapter(
          sections,
          store.currentChapterIndex,
        );

        if (activeIndex !== store.currentChapterIndex) {
          store.setCurrentChapterIndex(activeIndex);
        }

        // Contiguous loaded window around activeIndex — NOT activeIndex itself.
        // With short chapters, multiple sections can be visible at once, so the
        // "active" (closest-to-top) chapter is often nowhere near the actual
        // edge of what's loaded. maybeLoadNext/Previous need to check the real
        // boundary sections, not whichever one happens to be nearest the top.
        const loaded = store.loadedChapterIndices;

        let firstIndex = activeIndex;
        while (loaded.has(firstIndex - 1)) firstIndex--;

        let lastIndex = activeIndex;
        while (loaded.has(lastIndex + 1)) lastIndex++;

        logger.trace("handleScroll tick", {
          activeIndex,
          firstIndex,
          lastIndex,
          scrollY: win.scrollY,
          viewport,
          loadedChapterIndices: [...loaded],
        });

        maybeLoadNext(lastIndex, viewport);
        maybeLoadPrevious(firstIndex);

        const progress = computeReaderProgress({
          iframeDoc,
          win,
          activeIndex,
          totalChapters,
        });

        store.setProgressPercent(progress.percent);
        scheduleProgressSave(progress);

        if (!store.isMountingChapter) {
          maintainChapterWindow({
            iframeDoc,
            win,
            activeIndex,
            loadedIndices: loaded,
            onUnload: (index) => {
              logger.debug("unloading chapter", { index });
              store.removeLoadedChapterIndex(index);
            },
          });
        } else {
          logger.trace("windowing skipped — isMountingChapter");
        }
      };

      const loadChapter = (index: number, onSettled?: () => void) => {
        const store = readerStore.getState();
        logger.info("loadChapter", { index });

        store.setIsMountingChapter(true);

        try {
          mountChapter(iframeDoc, chapters[index] as ParsedChapter, index);
          logger.debug("chapter mounted", { index });
        } catch (error) {
          logger.error(`failed to mount chapter ${index}`, error);
          // Mount a placeholder in place of the throwing content so the
          // index is still considered loaded — otherwise the windowing
          // loop retries the same failing mount on every scroll tick.
          mountChapterFallback(iframeDoc, index);
        } finally {
          store.addLoadedChapterIndex(index);
          store.setIsMountingChapter(false);
          onSettled?.();
        }
      };

      const maybeLoadNext = (lastIndex: number, viewport: number) => {
        const store = readerStore.getState();

        if (!chapterLoader.hasNextChapter(lastIndex, totalChapters)) {
          logger.trace("maybeLoadNext — no next chapter (end of book)", {
            lastIndex,
          });
          return;
        }

        const next = lastIndex + 1;

        if (store.loadedChapterIndices.has(next)) {
          logger.trace("maybeLoadNext — already loaded", { next });
          return;
        }

        const documentHeight = iframeDoc.body.scrollHeight;
        const distanceToBottom = documentHeight - (win.scrollY + viewport);

        if (distanceToBottom > SCROLL_PREFETCH_THRESHOLD_PX) {
          logger.trace("maybeLoadNext — not within threshold", {
            lastIndex,
            distanceToBottom,
            documentHeight,
            scrollY: win.scrollY,
          });
          return;
        }

        logger.info("maybeLoadNext — triggering load", {
          next,
          distanceToBottom,
        });
        loadChapter(next);
      };

      const maybeLoadPrevious = (firstIndex: number) => {
        const firstSection = iframeDoc.querySelector(
          `section[data-chapter="${firstIndex}"]`,
        ) as HTMLElement | null;

        if (!firstSection) {
          logger.trace("maybeLoadPrevious — no section found for firstIndex", {
            firstIndex,
          });
          return;
        }

        if (
          win.scrollY >=
          firstSection.offsetTop + SCROLL_PREFETCH_THRESHOLD_PX
        ) {
          logger.trace("maybeLoadPrevious — not within threshold", {
            firstIndex,
            scrollY: win.scrollY,
            sectionTop: firstSection.offsetTop,
          });
          return;
        }

        const prev = firstIndex - 1;
        const store = readerStore.getState();

        if (!chapterLoader.hasPreviousChapter(firstIndex)) {
          logger.trace(
            "maybeLoadPrevious — no previous chapter (start of book)",
            {
              firstIndex,
            },
          );
          return;
        }
        if (store.loadedChapterIndices.has(prev)) {
          logger.trace("maybeLoadPrevious — already loaded", { prev });
          return;
        }

        const beforeHeight = iframeDoc.body.scrollHeight;
        const beforeScroll = win.scrollY;

        logger.info("maybeLoadPrevious — triggering load", { prev });

        loadChapter(prev, () => {
          const afterHeight = iframeDoc.body.scrollHeight;
          const delta = afterHeight - beforeHeight;
          logger.debug("maybeLoadPrevious — restoring scroll position", {
            beforeHeight,
            afterHeight,
            delta,
            newScrollY: beforeScroll + delta,
          });
          win.scrollTo(0, beforeScroll + delta);
        });
      };

      const restoreInitialPosition = (
        iframeDoc: Document,
        win: Window,
        progress: ReadingProgress,
      ) => {
        const store = readerStore.getState();
        const section = iframeDoc.querySelector(
          `section[data-chapter="${progress.chapterIndex}"]`,
        ) as HTMLElement | null;

        if (!section) {
          logger.debug(
            "restoreInitialPosition — target section not mounted, skipping jump",
            { chapterIndex: progress.chapterIndex },
          );
          handleScroll();
          return;
        }

        const sectionHeight = section.scrollHeight || section.offsetHeight || 0;
        const targetY =
          section.offsetTop + progress.scrollFraction * sectionHeight;

        logger.info("restoring saved reading position", {
          chapterIndex: progress.chapterIndex,
          scrollFraction: progress.scrollFraction,
          targetY,
        });

        store.setIsJumping(true);
        win.scrollTo(0, targetY);

        // Let the jump-triggered scroll event (ignored via isJumping) settle,
        // then release the guard and run one real handleScroll to sync
        // windowing/loading state to the restored position.
        requestAnimationFrame(() => {
          store.setIsJumping(false);
          handleScroll();
        });
      };

      let ticking = false;

      const onScroll = () => {
        if (ticking) return;
        ticking = true;

        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
      };

      const onLinkClick = (e: MouseEvent) => {
        const anchor = (e.target as Element).closest("a");
        if (!anchor) return;

        const href = anchor.getAttribute("href");
        if (!href) return;

        // External link — open in parent window's new tab, never navigate iframe
        if (/^[a-z][a-z\d+\-.]*:/i.test(href)) {
          e.preventDefault();
          onExternalLink?.(href);
          return;
        }

        // Internal link — resolve relative to the active chapter's own href,
        // since sibling-relative paths like "../notes/endnotes.xhtml" are
        // relative to the chapter file, not the OPF directory.
        const activeChapter =
          chapters[readerStore.getState().currentChapterIndex];
        if (!activeChapter) return;

        const chapterBasePath = activeChapter.href.includes("/")
          ? activeChapter.href.slice(0, activeChapter.href.lastIndexOf("/") + 1)
          : "";

        // Resolve the clicked href against the chapter's directory (same
        // URL trick used elsewhere in the codebase for path resolution).
        const [hrefPath, fragmentId] = href.split("#") as [
          string,
          string | undefined,
        ];

        const resolvedPath = new URL(
          hrefPath,
          `http://epub/${chapterBasePath}`,
        ).pathname.slice(1);

        // Find the spine index whose manifest href matches the resolved path
        const spineIndex = chapters.findIndex((ch) => {
          // ch.href is relative to OPF directory; resolvedPath is also relative
          // to OPF directory after the URL resolution above, so direct compare works.
          return ch.href === resolvedPath;
        });

        if (spineIndex === -1) {
          // Not in spine — let the browser handle it (no-op in sandbox)
          return;
        }

        e.preventDefault();

        jumpToTocItem(
          {
            label: "",
            href,
            chapterIndex: spineIndex,
            fragmentId,
            children: [],
          },
          iframeDoc,
          win,
          chapters,
        );
      };

      let attempts = 0;

      const waitForInitialSections = () => {
        if (cancelled) {
          logger.debug("waitForInitialSections aborted — effect cancelled");
          return;
        }

        const store = readerStore.getState();
        const plan = chapterLoader.getLoadPlan(
          store.currentChapterIndex,
          totalChapters,
          store.loadedChapterIndices,
        );

        if (attempts === 0) {
          logger.info("initial load plan", { plan });
        }

        plan.toLoad.forEach((index) => loadChapter(index));

        const sections = getChapterSections(iframeDoc);

        if (!iframeDoc.body || sections.length === 0) {
          if (attempts === 0) {
            logger.debug("waiting for initial sections to appear in DOM", {
              hasBody: !!iframeDoc.body,
              sectionCount: sections.length,
            });
          }

          if (attempts++ < ENGINE_START_MAX_ATTEMPTS) {
            requestAnimationFrame(waitForInitialSections);
          } else {
            logger.error(
              `gave up waiting for chapter sections after ${ENGINE_START_MAX_ATTEMPTS} attempts`,
            );
          }
          return;
        }

        logger.info("initial sections ready — attaching scroll listener", {
          attempts,
          sectionCount: sections.length,
        });

        win.addEventListener("scroll", onScroll, { passive: true });
        iframeDoc.addEventListener("click", onLinkClick);

        if (!restoredInitialPosition && initialProgress) {
          restoredInitialPosition = true;
          restoreInitialPosition(iframeDoc, win, initialProgress);
        } else {
          handleScroll();
        }
      };

      waitForInitialSections();

      scrollCleanup = () => {
        logger.debug("removing scroll listener");
        win.removeEventListener("scroll", onScroll);
        iframeDoc.removeEventListener("click", onLinkClick);
      };
    };

    initializeChapterDocument(iframe, chapters, bookId);
    logger.debug("initializeChapterDocument called, waiting for load event");

    const handleIframeLoad = () => {
      if (cancelled) {
        logger.debug("iframe load fired but effect already cancelled");
        return;
      }

      const iframeDoc = iframe.contentDocument;
      const win = iframe.contentWindow;

      logger.debug("iframe load event fired", {
        hasDoc: !!iframeDoc,
        hasWin: !!win,
      });

      if (!iframeDoc || !win) {
        logger.error(
          "iframe load fired but contentDocument/contentWindow missing",
        );
        return;
      }

      startEngine(iframeDoc, win);
    };

    iframe.addEventListener("load", handleIframeLoad);

    return () => {
      logger.info("effect cleanup");
      cancelled = true;
      iframe.removeEventListener("load", handleIframeLoad);
      scrollCleanup?.();
      preferenceCleanup?.();

      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushPendingProgress);

      flushPendingProgress();

      // ponytail: assetMap blob URLs are baked into chapter.content and reused
      // verbatim across mount/unmount cycles, so they can only be revoked once
      // the whole book is torn down — not when a chapter slides out of the window.
      chapters.forEach((chapter) => {
        chapter.assetMap.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
      });
    };
  }, [
    iframeRef,
    parsedBook,
    chapterLoader,
    bookId,
    initialProgress,
    onExternalLink,
  ]);
}
