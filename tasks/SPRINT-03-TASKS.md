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

All four done:

1. ✅ **#14 Use-after-revoke blob URLs** — images break permanently on scroll-back _(done 2026-07-31)_
2. ✅ **#9 Malformed XHTML guard** — browser parser error rendered as chapter content _(done 2026-07-31)_
3. ✅ **#15 Rerender control** — full-tree re-render on every scroll tick _(done 2026-07-31)_
4. ✅ **#17 Gate logger** — TRACE logging per rAF tick in production _(done 2026-07-31)_

---

## Day 1 — Reader State & Synchronization

1. ✅ **Lazy/async book parsing** — `src/services/epub/epub-parser.ts` eagerly parses ALL chapters and mints every asset blob URL on open, on the main thread, before first paint. Biggest open-flow and memory gap. _(done 2026-08-02 — lighter approach: chapters come back as stubs from `parseBook()`, parsed/blob-minted on demand via `loadChapter()`, memoized. Book-level CSS split out of per-chapter parsing into `ChapterParser.loadBookStylesheets()` since it was only ever consumed at iframe-init time, never per-chapter. `parseBook()` for a 368-chapter book: ~1.7s → ~84ms. See "OPFS-based normalized storage" below for the bigger architecture this defers.)_
2. ✅ **Restore retry** — `restoreInitialPosition()` in `use-reader-engine.ts` silently drops the restore if the target section isn't mounted yet; no `readyState` fallback if the iframe `load` event fires before the effect attaches. _(done 2026-08-01)_
3. ✅ **Scroll-fraction drift** — restore multiplies stored fraction by `scrollHeight`; font/viewport changes between sessions shift the position. No element-anchor (CFI-like) fallback. _(done 2026-08-02)_

## Day 2 — Navigation Refinements

4. ✅ **TOC depth indentation** — `flatten-toc.ts` computes `depth` but `toc-drawer.tsx` discards it (deep TOCs render flat). Also `key={item.href}` collides when entries share an href. _(done 2026-08-01)_
5. ✅ **Post-jump window reconciliation** — after a TOC jump the loaded chapter set is non-contiguous; no re-plan via `maintainChapterWindow`, and progress isn't recomputed if no scroll event fires. _(done 2026-08-01)_
6. ✅ **Return-to-position after footnote jump** — no history; tapping an endnote loses the reading position. _(done 2026-08-01)_
7. ✅ **Prev/next chapter controls** — footer shows `n of m` text only. _(done 2026-08-01)_
8. ✅ **Fragment offset** — `jump-to-toc-item.ts` uses `offsetTop` assuming the section is the offsetParent; needs `getBoundingClientRect` fallback for positioned publisher HTML. _(done 2026-08-01)_

## Day 3 — Rendering Robustness

9. ✅ **Malformed XHTML guard** — `ChapterParser.parseChapter` (`src/services/epub/parsers/chapter-parser.ts`) has no `parsererror` check; a single bad entity renders the browser's error document as the chapter. Mirror the guard + `text/html` fallback already in `epub.service.ts`. _(done 2026-07-31)_
10. ✅ **Image hardening** — no `img { max-width: 100% }` in base style (wide images force horizontal scroll), no `loading="lazy"`, no `onerror` fallback; SVG `<image xlink:href>` not resolved and `svg` not in `ALLOWED_TAGS`. _(done 2026-08-01)_
11. ✅ **Inline style fidelity** — sanitizer strips `style` attributes and `<style>` blocks; only linked CSS survives. Decide and document the tradeoff. _(done 2026-08-02)_
12. ✅ **Offline fonts** — iframe loads Literata from Google Fonts CDN only; first offline read falls back to system serif. Consider self-hosting. _(done 2026-08-01)_
13. ✅ **Robustness tests** — `invalid.epub` / `broken-spine.epub` fixtures exist but no chapter-level graceful-degradation tests; no image-heavy EPUB tests. _(done 2026-08-02)_

## Day 4 — Performance Optimisation

14. ✅ **Use-after-revoke bug** — `revokeChapterAssets()` in `chapter-window.ts` revokes blob URLs still baked into the chapter's HTML string and shared CSS `assetMap`; scrolling back leaves images broken for the session. Needs refcounting or lazy re-mint. _Correctness bug, top priority._ _(done 2026-07-31)_
15. ✅ **Rerender control** — `reader-screen.tsx` calls `readerStore()` without a selector, so every scroll-tick `setProgressPercent` re-renders header, frame, and `TocDrawer`, re-running `flattenToc` on the whole tree. Add selectors + memoize. _(done 2026-07-31)_
16. ✅ **Scroll-tick layout thrash** — `getChapterSections()` runs querySelectorAll + rect reads on every tick; cache sections or use `IntersectionObserver`. _(done 2026-08-01)_
17. ✅ **Gate logger** — root logger is unconditionally enabled at TRACE (`src/shared/logger/logger.ts`); `handleScroll` traces fire per rAF tick in production. Gate on `import.meta.env.DEV`. _(done 2026-07-31)_
18. ✅ **Perf benchmark** — `large-book.epub` fixture exists but no reader performance test uses it. _(done 2026-08-02)_

## Day 5 — Reader UX Polish

19. ✅ **Loading experience** — bare "Loading reader..." text; show title/cover skeleton (matters more while parsing stays eager). _(done 2026-07-31)_
20. ✅ **Reader toolbar** — no font size, line height, or theme controls; `--reading-line-height` token exists but isn't adjustable. _(done 2026-07-31)_
21. ✅ **Orientation/resize handling** — nothing listens to `resize`/`orientationchange`; rotating loses reading position (restore runs only once at mount). _(done 2026-07-31)_
22. ✅ **Viewport units** — `reader-screen.tsx` uses `h-screen`, not `h-dvh`; footer sits under mobile Safari's URL bar (`TocDrawer` already uses `dvh`). _(done 2026-08-01)_
23. ✅ **Touch/keyboard interaction** — no gestures, no PgUp/PgDn/arrow handling, iframe not focusable. PgUp/PgDn/arrows scroll, iframe is focusable. Swipe-gesture detection exists in `use-reader-engine.ts` (`onSwipeChapter` prop) but isn't wired to anything — chapter nav is buttons + scroll only, swipe felt redundant on a continuous-scroll reader. _(done 2026-08-01)_

## Day 6 — Error Handling & Recovery

24. ✅ **Reader-scoped error boundary** — only the global boundary in `app.tsx` exists; its `reset()` re-renders the crashing tree with no back-to-library escape. The `fallback` prop is unused. _(done 2026-07-31)_
25. ✅ **Per-chapter mount-failure fallback** — failed `mountChapter` is logged and swallowed; the engine retries the same failing mount every scroll tick with no "chapter couldn't be displayed" UI. _(done 2026-07-31)_
26. ✅ **Error screen dead end** — `ReaderScreen` error panel has no retry or back-to-library link. _(done 2026-07-31)_
27. ✅ **Unsupported EPUB detection** — no `encryption.xml`/DRM check; corrupted vs unsupported vs DRM'd all surface a raw internal error message. _(done 2026-07-31)_

## Day 7 — Hardening

28. ✅ **Component tests** — `reader-screen`, `toc-drawer`, `reader-frame`, `external-link-dialog`, `flatten-toc`, `error-boundary` all untested. _(done 2026-07-31)_
29. ✅ **Library↔reader seam test** — progress write → `deriveReadingStatus` → continue-reading round-trip; each half is tested, the seam is not. _(done 2026-08-01)_

---

# Deferred to a Later Sprint

## OPFS-based normalized storage (was docs/04, never implemented)

`docs/04 - Implementation Planning/02 - Storage Architecture.md` and
`04 - Normalized EPUB Format.md` describe a hybrid storage model that
was designed but never built: on import, extract + normalize the EPUB
into individual files written to **OPFS** (Origin Private File System)
— `meta.json`, `spine.json`, `toc.json`, `/chapters/ch_0001.xhtml`,
`/assets/*` — with IndexedDB holding only lightweight metadata +
progress. `chapter-loader.ts`'s own doc comment still says it's
"responsible for retrieving chapter content from OPFS," but what
actually got built is a much smaller DOM-free class that only computes
_which indices_ should be mounted (windowing math) — the OPFS-backed
responsibility was never implemented. What actually shipped instead
(see #1 above): the raw `.epub` Blob stays in IndexedDB, and
`EpubParser` now parses chapters lazily/on-demand from that in-memory
JSZip archive rather than eagerly, closing the immediate first-paint
gap without touching the storage layer.

**Why this is still worth doing eventually**: the JSZip-blob approach
still re-parses and re-sanitizes a chapter's XHTML from scratch every
time it's visited, in every session — nothing survives a reload. The
compressed archive also has to stay resident in memory for the whole
reading session. OPFS-normalized files would parse/sanitize once at
import, then just get read (cheap file I/O) forever after, and only
ever hold in memory whatever chapter is actually being read.

**Why it was deferred**: much bigger lift than the lazy-parsing fix —
new `opfs-storage.ts` layer, import pipeline rewritten to normalize +
write instead of just storing a blob, `chapter-loader.ts` gets real
file-reading responsibility, and every book already imported by
existing users needs a migration path (extract-to-OPFS on next open,
or dual-path support for old vs new books). New failure modes to
handle (OPFS write/quota errors, partial-normalization cleanup). It's
the riskiest kind of change to take on speculatively, since it touches
the hot path for every single book open — worth doing once repeated-
session re-parse cost or large-book memory is an actual reported pain
point, not before.
