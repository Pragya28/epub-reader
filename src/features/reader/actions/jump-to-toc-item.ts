import type { ParsedBook, TocItem } from "@/services/epub/epub-types";
import { readerStore } from "../store/reader-store";
import { mountChapter } from "../engine/renderer/chapter-renderer";
import { invalidateChapterSections } from "../engine/scroll/get-chapter-sections";
import { logger as rootLogger } from "@/shared/logger/logger";

const logger = rootLogger.child("jump-to-toc-item");

/**
 * Navigates the reader iframe to a TOC item.
 *
 * Steps:
 *  1. Ensure the target chapter is loaded and mounted in the iframe.
 *  2. Set isJumping so scroll events are ignored during the programmatic scroll.
 *  3. Scroll to the fragment element (if any) or the top of the chapter section.
 *  4. Update currentChapterIndex.
 *  5. Release isJumping on the next animation frame.
 *
 * This is intentionally a fire-and-forget action (called from a UI click
 * handler). Errors are logged but not surfaced — a failed jump is not
 * worth crashing the reader over.
 */
export async function jumpToTocItem(
  tocItem: TocItem,
  iframeDoc: Document,
  win: Window,
  parsedBook: ParsedBook,
): Promise<void> {
  const { chapterIndex, fragmentId } = tocItem;
  const totalChapters = parsedBook.chapters.length;

  if (chapterIndex < 0 || chapterIndex >= totalChapters) {
    logger.warn("jumpToTocItem — chapterIndex out of range", {
      chapterIndex,
      totalChapters,
    });
    return;
  }

  const store = readerStore.getState();

  try {
    // Ensure chapter is loaded and mounted
    if (!store.loadedChapterIndices.has(chapterIndex)) {
      logger.info("jumpToTocItem — loading target chapter", { chapterIndex });
      const chapter = await parsedBook.loadChapter(chapterIndex);
      store.setIsMountingChapter(true);
      try {
        mountChapter(iframeDoc, chapter, chapterIndex);
        invalidateChapterSections(iframeDoc);
        store.addLoadedChapterIndex(chapterIndex);
      } finally {
        store.setIsMountingChapter(false);
      }
    }

    const section = iframeDoc.querySelector(
      `section[data-chapter="${chapterIndex}"]`,
    ) as HTMLElement | null;

    if (!section) {
      logger.warn("jumpToTocItem — section not found after mount", {
        chapterIndex,
      });
      return;
    }

    // Resolve scroll target: fragment element or section top. getBoundingClientRect
    // + current scroll offset works regardless of the offsetParent chain, unlike
    // offsetTop which silently breaks under positioned publisher HTML ancestors.
    let target: HTMLElement = section;

    if (fragmentId) {
      const fragmentEl = iframeDoc.getElementById(fragmentId);
      if (fragmentEl) {
        target = fragmentEl;
        logger.debug("jumpToTocItem — scrolling to fragment", { fragmentId });
      } else {
        logger.debug(
          "jumpToTocItem — fragment element not found, falling back to section top",
          { fragmentId },
        );
      }
    }

    const targetY = win.scrollY + target.getBoundingClientRect().top;

    logger.info("jumpToTocItem — scrolling", {
      chapterIndex,
      fragmentId,
      targetY,
    });

    store.setIsJumping(true);
    store.setCurrentChapterIndex(chapterIndex);
    win.scrollTo(0, targetY);

    // The native 'scroll' event fired by scrollTo() above is ignored by
    // handleScroll while isJumping is true (by design, so the programmatic
    // jump doesn't get misread as user scrolling) — which means window
    // reconciliation (unloading far chapters, prefetching neighbors) and
    // progress recomputation never happen unless the user scrolls again
    // afterward. Dispatching a synthetic scroll event once isJumping clears
    // lets the already-attached onScroll listener run that reconciliation
    // for us, the same way restoreInitialPosition does with its own
    // explicit handleScroll() call.
    requestAnimationFrame(() => {
      store.setIsJumping(false);
      win.dispatchEvent(new Event("scroll"));
    });
  } catch (error) {
    logger.error("jumpToTocItem — unexpected error", error);
    // Always release the jumping guard, even on error
    store.setIsJumping(false);
  }
}
