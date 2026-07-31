# Sprint 3 — Task List (Gap Analysis vs Codebase)

Generated 2026-07-31 by comparing `docs/06 - Implementation/Sprint - 03 Reader Performance & Stability.md` against the current codebase.

Legend: ✅ done · 🟡 partial · ❌ missing

---

# Already Complete (Sprint 3 credit)

- **Progress save pipeline** — debounced (1.5s), flushed on `visibilitychange`/`pagehide`/unmount, synced to library store + IndexedDB (`src/features/reader/hooks/use-reader-engine.ts`, `src/features/reader/actions/save-reader-progress.ts`)
- **Restore on open** — `load-reader-book.ts` seeds chapter index + scroll fraction; `restoreInitialPosition()` re-scrolls
- **TOC navigation** — EPUB3 nav + NCX, nested parsing, invalid-anchor fallback (`jump-to-toc-item.ts`), external-link confirmation dialog
- **Windowing** — `chapter-window.ts` (max 5 mounted), prefetch, rAF-throttled scroll
- **Sanitization** — DOMPurify on chapter HTML, stylesheet stripping (`expression()`, `javascript:`, `@import`)
- **Unit coverage** — ~4,000 lines of tests across actions, engine, store, parsers

---

# Priority Callout

Do these first — two are live correctness bugs:

1. **#14 Use-after-revoke blob URLs** — images break permanently on scroll-back
2. **#9 Malformed XHTML guard** — browser parser error rendered as chapter content
3. **#15 Rerender control** — full-tree re-render on every scroll tick
4. **#17 Gate logger** — TRACE logging per rAF tick in production

---

## Day 1 — Reader State & Synchronization

1. ❌ **Lazy/async book parsing** — `src/services/epub/epub-parser.ts` eagerly parses ALL chapters and mints every asset blob URL on open, on the main thread, before first paint. Biggest open-flow and memory gap.
2. 🟡 **Restore retry** — `restoreInitialPosition()` in `use-reader-engine.ts` silently drops the restore if the target section isn't mounted yet; no `readyState` fallback if the iframe `load` event fires before the effect attaches.
3. 🟡 **Scroll-fraction drift** — restore multiplies stored fraction by `scrollHeight`; font/viewport changes between sessions shift the position. No element-anchor (CFI-like) fallback.

## Day 2 — Navigation Refinements

4. ❌ **TOC depth indentation** — `flatten-toc.ts` computes `depth` but `toc-drawer.tsx` discards it (deep TOCs render flat). Also `key={item.href}` collides when entries share an href.
5. ❌ **Post-jump window reconciliation** — after a TOC jump the loaded chapter set is non-contiguous; no re-plan via `maintainChapterWindow`, and progress isn't recomputed if no scroll event fires.
6. ❌ **Return-to-position after footnote jump** — no history; tapping an endnote loses the reading position.
7. ❌ **Prev/next chapter controls** — footer shows `n of m` text only.
8. 🟡 **Fragment offset** — `jump-to-toc-item.ts` uses `offsetTop` assuming the section is the offsetParent; needs `getBoundingClientRect` fallback for positioned publisher HTML.

## Day 3 — Rendering Robustness

9. ❌ **Malformed XHTML guard** — `ChapterParser.parseChapter` (`src/services/epub/parsers/chapter-parser.ts`) has no `parsererror` check; a single bad entity renders the browser's error document as the chapter. Mirror the guard + `text/html` fallback already in `epub.service.ts`.
10. ❌ **Image hardening** — no `img { max-width: 100% }` in base style (wide images force horizontal scroll), no `loading="lazy"`, no `onerror` fallback; SVG `<image xlink:href>` not resolved and `svg` not in `ALLOWED_TAGS`.
11. 🟡 **Inline style fidelity** — sanitizer strips `style` attributes and `<style>` blocks; only linked CSS survives. Decide and document the tradeoff.
12. 🟡 **Offline fonts** — iframe loads Literata from Google Fonts CDN only; first offline read falls back to system serif. Consider self-hosting.
13. ❌ **Robustness tests** — `invalid.epub` / `broken-spine.epub` fixtures exist but no chapter-level graceful-degradation tests; no image-heavy EPUB tests.

## Day 4 — Performance Optimisation

14. ❌ **Use-after-revoke bug** — `revokeChapterAssets()` in `chapter-window.ts` revokes blob URLs still baked into the chapter's HTML string and shared CSS `assetMap`; scrolling back leaves images broken for the session. Needs refcounting or lazy re-mint. _Correctness bug, top priority._
15. ❌ **Rerender control** — `reader-screen.tsx` calls `readerStore()` without a selector, so every scroll-tick `setProgressPercent` re-renders header, frame, and `TocDrawer`, re-running `flattenToc` on the whole tree. Add selectors + memoize.
16. 🟡 **Scroll-tick layout thrash** — `getChapterSections()` runs querySelectorAll + rect reads on every tick; cache sections or use `IntersectionObserver`.
17. ❌ **Gate logger** — root logger is unconditionally enabled at TRACE (`src/shared/logger/logger.ts`); `handleScroll` traces fire per rAF tick in production. Gate on `import.meta.env.DEV`.
18. ❌ **Perf benchmark** — `large-book.epub` fixture exists but no reader performance test uses it.

## Day 5 — Reader UX Polish

19. ❌ **Loading experience** — bare "Loading reader..." text; show title/cover skeleton (matters more while parsing stays eager).
20. ❌ **Reader toolbar** — no font size, line height, or theme controls; `--reading-line-height` token exists but isn't adjustable.
21. ❌ **Orientation/resize handling** — nothing listens to `resize`/`orientationchange`; rotating loses reading position (restore runs only once at mount).
22. 🟡 **Viewport units** — `reader-screen.tsx` uses `h-screen`, not `h-dvh`; footer sits under mobile Safari's URL bar (`TocDrawer` already uses `dvh`).
23. ❌ **Touch/keyboard interaction** — no gestures, no PgUp/PgDn/arrow handling, iframe not focusable.

## Day 6 — Error Handling & Recovery

24. ❌ **Reader-scoped error boundary** — only the global boundary in `app.tsx` exists; its `reset()` re-renders the crashing tree with no back-to-library escape. The `fallback` prop is unused.
25. ❌ **Per-chapter mount-failure fallback** — failed `mountChapter` is logged and swallowed; the engine retries the same failing mount every scroll tick with no "chapter couldn't be displayed" UI.
26. 🟡 **Error screen dead end** — `ReaderScreen` error panel has no retry or back-to-library link.
27. ❌ **Unsupported EPUB detection** — no `encryption.xml`/DRM check; corrupted vs unsupported vs DRM'd all surface a raw internal error message.

## Day 7 — Hardening

28. ❌ **Component tests** — `reader-screen`, `toc-drawer`, `reader-frame`, `external-link-dialog`, `flatten-toc`, `error-boundary` all untested.
29. ❌ **Library↔reader seam test** — progress write → `deriveReadingStatus` → continue-reading round-trip; each half is tested, the seam is not.
