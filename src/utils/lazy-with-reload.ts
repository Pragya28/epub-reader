import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RELOAD_FLAG = "librune:chunk-reload-attempted";

/**
 * Wraps a `React.lazy` loader so a stale chunk reference — the page's
 * already-loaded shell trying to `import()` a route chunk by a hash the
 * service worker no longer has, because `cleanupOutdatedCaches` (see
 * vite.config.ts) already dropped the previous build's files once a new
 * version activated — triggers one full reload instead of surfacing as an
 * uncaught render error. Without this, that failure bubbles to the
 * top-level ErrorBoundary (src/app/app.tsx) and blanks the *entire* app,
 * not just the route being opened — reported as "Settings didn't load,
 * then worked on retry".
 *
 * Reloads at most once per tab session (sessionStorage-gated) — a second
 * failure right after a fresh load is a real error (genuinely offline with
 * nothing cached, a broken deploy) and should hit the boundary normally
 * rather than reload-looping.
 */
// `any` here (not `unknown`) matches React.lazy's own loose ComponentType
// typing — a stricter bound rejects ordinary FC<{}> components.
export function lazyWithReload<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    loader().catch((error: unknown) => {
      let alreadyReloaded = false;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === "1";
      } catch {
        // Storage unavailable (private mode, denied) — fail through to the
        // rethrow below rather than reload-looping blind.
      }

      if (alreadyReloaded) throw error;

      try {
        sessionStorage.setItem(RELOAD_FLAG, "1");
      } catch {
        // Can't set the guard — safer to just throw than risk an
        // unbounded reload loop.
        throw error;
      }

      window.location.reload();
      // The reload navigates away before a real value would matter; never
      // resolve so React doesn't render with a `default: undefined`.
      return new Promise<{ default: T }>(() => {});
    }),
  );
}
