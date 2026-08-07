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
export function useChromeVisibility() {
  const [visible, setVisible] = useState(true);
  const overlayOpen = useRef(false);

  const handleScrollDirection = useCallback((direction: "up" | "down") => {
    if (overlayOpen.current) return;
    setVisible(direction === "up");
  }, []);

  const toggle = useCallback(() => {
    if (overlayOpen.current) return;
    setVisible((current) => !current);
  }, []);

  const setOverlay = useCallback((open: boolean) => {
    overlayOpen.current = open;
    if (open) setVisible(true);
  }, []);

  return { visible, handleScrollDirection, toggle, setOverlay };
}
