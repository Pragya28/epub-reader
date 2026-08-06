import { useCallback, useState } from "react";

/**
 * Reader header/footer visibility: shown by default, hidden on scroll-down,
 * revealed on scroll-up or a tap on the reading content. An open overlay
 * (reader toolbar, TOC drawer, external-link dialog) forces it back visible
 * and suspends scroll/tap-driven changes until closed.
 */
export function useReaderChrome() {
  const [visible, setVisible] = useState(true);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const handleScrollDirection = useCallback(
    (direction: "up" | "down") => {
      if (overlayOpen) return;
      setVisible(direction === "up");
    },
    [overlayOpen],
  );

  const toggle = useCallback(() => {
    if (overlayOpen) return;
    setVisible((current) => !current);
  }, [overlayOpen]);

  const setOverlay = useCallback((open: boolean) => {
    setOverlayOpen(open);
    if (open) setVisible(true);
  }, []);

  return { visible, handleScrollDirection, toggle, setOverlay };
}
