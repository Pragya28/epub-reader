import { useCallback, useRef, useState } from "react";

/**
 * Header/footer chrome visibility: shown by default, hidden on scroll-down,
 * revealed on scroll-up or a tap on the content. An open overlay (a sheet,
 * drawer, or dialog) forces it back visible and suspends scroll/tap-driven
 * changes until closed.
 *
 * The overlay flag is a ref, not state: nothing renders from it, and as
 * state it made `handleScrollDirection`/`toggle` change identity every time
 * a sheet opened or closed. `useReaderEngine` depends on those callbacks, so
 * that re-ran the whole engine effect — rewriting the iframe's srcdoc while
 * `loadedChapterIndices` still claimed the chapters were mounted, leaving
 * the reader permanently blank after closing the preferences sheet.
 */
// Momentum/rubber-band scrolling wobbles scroll position by a pixel or two
// while decelerating or bouncing at a boundary — reacting to every such change
// flips visibility many times a second. A minimum-delta threshold before
// honoring a direction change absorbs that jitter.
const SCROLL_DIRECTION_THRESHOLD_PX = 10;

export function useChromeVisibility() {
  const [visible, setVisible] = useState(true);
  const overlayOpen = useRef(false);
  const lastScrollPos = useRef(0);

  const handleScrollDirection = useCallback((direction: "up" | "down") => {
    if (overlayOpen.current) return;
    setVisible(direction === "up");
  }, []);

  // Feed raw scroll position from whichever listener the caller already has
  // (outer window, an iframe's contentWindow, ...); the threshold/debounce
  // math lives here once instead of being re-tuned at every call site.
  const handleScroll = useCallback(
    (scrollPos: number) => {
      const pos = Math.max(0, scrollPos);
      if (pos <= 0) {
        handleScrollDirection("up");
      } else if (
        Math.abs(pos - lastScrollPos.current) >= SCROLL_DIRECTION_THRESHOLD_PX
      ) {
        handleScrollDirection(pos > lastScrollPos.current ? "down" : "up");
      } else {
        return;
      }
      lastScrollPos.current = pos;
    },
    [handleScrollDirection],
  );

  const toggle = useCallback(() => {
    if (overlayOpen.current) return;
    setVisible((current) => !current);
  }, []);

  const setOverlay = useCallback((open: boolean) => {
    overlayOpen.current = open;
    if (open) setVisible(true);
  }, []);

  return { visible, handleScroll, toggle, setOverlay };
}
