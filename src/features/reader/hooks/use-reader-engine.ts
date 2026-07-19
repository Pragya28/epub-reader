import { useEffect, useMemo } from "react";
import type { RefObject } from "react";
import type { ParsedBook, ParsedChapter } from "@/services/epub/epub-types";
import { readerStore } from "../store/reader-store";
import { ChapterLoader } from "../engine/loader/chapter-loader";
import { getChapterSections } from "../engine/scroll/get-chapter-sections";
import { detectVisibleChapter } from "../engine/scroll/detect-visible-chapter";
import { maintainChapterWindow } from "../engine/windowing/chapter-window";
import {
  initializeChapterDocument,
  mountChapter,
} from "../engine/renderer/chapter-renderer";
import { logger as rootLogger } from "@/shared/logger/logger";

const SCROLL_PREFETCH_THRESHOLD_PX = 300;
const ENGINE_START_MAX_ATTEMPTS = 120;

const logger = rootLogger.child("reader-engine");

interface UseReaderEngineProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  parsedBook: ParsedBook | null;
}

export function useReaderEngine({
  iframeRef,
  parsedBook,
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
    let cancelled = false;

    const startEngine = (iframeDoc: Document, win: Window) => {
      logger.info("startEngine — iframe document ready", {
        readyState: iframeDoc.readyState,
      });

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

        if (!store.isMountingChapter) {
          maintainChapterWindow({
            iframeDoc,
            win,
            activeIndex,
            chapters,
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
          store.addLoadedChapterIndex(index);
          logger.debug("chapter mounted", { index });
        } catch (error) {
          logger.error(`failed to mount chapter ${index}`, error);
        } finally {
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

      let ticking = false;

      const onScroll = () => {
        if (ticking) return;
        ticking = true;

        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
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
        handleScroll();
      };

      waitForInitialSections();

      scrollCleanup = () => {
        logger.debug("removing scroll listener");
        win.removeEventListener("scroll", onScroll);
      };
    };

    initializeChapterDocument(iframe, chapters);
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
    };
  }, [iframeRef, parsedBook, chapterLoader]);
}
