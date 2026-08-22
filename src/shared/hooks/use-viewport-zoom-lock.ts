import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ROUTES } from "@/utils/routes";

const UNLOCKED = "width=device-width, initial-scale=1.0";
const LOCKED = `${UNLOCKED}, maximum-scale=1.0, user-scalable=no`;
// ROUTES.READER is "/reader/:bookId" — the static prefix up to the param
// is what a real pathname ("/reader/abc123") actually starts with.
const READER_PATH_PREFIX = ROUTES.READER.split(":")[0];

/**
 * Pinch-zoom is disabled everywhere except the reader: elsewhere it mostly
 * fights the app's own gestures (the library FAB's arc, drag-to-reorder,
 * ...) without giving the user anything to zoom into, but inside the
 * reader it's a legitimate way to get bigger text, so it stays enabled
 * there rather than forcing everyone through Settings.
 *
 * Toggled via the viewport meta tag's content, not CSS `touch-action` —
 * touch-action doesn't reliably suppress the browser's own page-level
 * pinch-zoom (notably on iOS Safari), while user-scalable does.
 */
export function useViewportZoomLock() {
  const { pathname } = useLocation();
  const isReader = pathname.startsWith(READER_PATH_PREFIX);

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) meta.setAttribute("content", isReader ? UNLOCKED : LOCKED);
  }, [isReader]);
}
