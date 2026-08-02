# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Librune — a local-first EPUB reader PWA (React 19 + TypeScript + Vite). All book data (files, covers, reading progress) lives in IndexedDB; nothing is uploaded to a server.

`docs/` is a symlink to `~/Personal/some-any-every-thing/04-Projects/Epub Reader` (planning notes, sprint specs) — not tracked in this repo's git history.

## Commands

```bash
pnpm dev            # start dev server
pnpm build           # tsc -b && vite build
pnpm lint            # eslint .
pnpm test            # vitest (watch mode)
pnpm test:run        # vitest run (single pass, use in CI/scripts)
pnpm test:ui         # vitest with UI
pnpm coverage        # vitest run --coverage
```

Run a single test file: `pnpm test:run src/features/reader/engine/windowing/__tests__/chapter-window.test.ts`

Git hooks (husky) already enforce quality gates — don't skip them:

- `pre-commit`: `lint-staged` (eslint --fix + prettier on staged files) then `pnpm test`
- `pre-push`: `pnpm build` then `pnpm test`

Package manager is pnpm (`packageManager` pinned in package.json) — don't use npm/yarn.

## Architecture

### Layout

- `src/app/` — routing shell only (`router.tsx`, three screens: library/reader/settings). Thin composition, no business logic.
- `src/features/{library,reader}/` — vertical slices, each with `store/`, `actions/`, `components/`, `types/`, `utils/`. `reader/` additionally owns `engine/` (custom chapter rendering pipeline) and `hooks/`.
- `src/services/{epub,storage}/` — framework-agnostic infra. `epub/` parses EPUB files; `storage/` wraps Dexie/IndexedDB.
- `src/components/` — shadcn/ui primitives (`ui/`) plus cross-cutting `toast/` and `error-boundary/`.
- `src/shared/` — cross-feature utilities not tied to one layer (`logger/`, `ornaments.ts` — decorative SVGs injected into the reader iframe).
- `src/constants/`, `src/utils/` — pure data tables / generic helpers (`cn.ts`, `routes.ts`, `create-book-id.ts`, `hash.ts`).

Tests are colocated in `__tests__/` next to the code they cover, not centralized.

### EPUB parsing (no epub.js)

`services/epub/epub.service.ts` unzips with **JSZip** and reads `container.xml`/OPF via native `DOMParser`. `epub-parser.ts` orchestrates `parsers/{opf,chapter,toc}-parser.ts` into a `ParsedBook` (metadata + chapters + toc).

### Reader rendering — windowed iframe engine

`features/reader/engine/` is a hand-built virtualized renderer, not a library:

- `renderer/iframe-renderer.ts` writes book HTML into a single `srcdoc` iframe. The iframe is a separate document, so it does **not** inherit the parent app's CSS custom properties or Google Fonts `<link>` — those tokens are hand-mirrored inside this file from `src/index.css` (light + `prefers-color-scheme: dark`). If you change reading-related tokens in `index.css`, update this file too.
- Stylesheets from the EPUB are sanitized (`expression()`, `javascript:` URLs, `@import` stripped) before being injected into the iframe.
- `windowing/chapter-window.ts` keeps only `MAX_WINDOW_SIZE = 5` chapters mounted at once.
- `scroll/detect-visible-chapter.ts` + `loader/chapter-loader.ts` drive mount/unmount as the user scrolls.
- `hooks/use-reader-engine.ts` is the glue hook wiring load/mount/scroll/progress-save together.

### Storage (Dexie / IndexedDB)

`services/storage/db.ts` — DB name `librune-db`, currently schema v3, three tables: `books` (metadata + optional embedded `progress`/`manualStatus`), `bookFiles` (raw epub Blob), `bookCovers` (cover Blob). `book-repository.ts` / `cover-cache.ts` wrap raw Dexie calls. When adding a new indexed field, add a new `db.version(n).stores(...)` block (see the v3 comment for the pattern — no data migration needed since Dexie only reindexes on next write).

Service worker (`vite-plugin-pwa`, see `vite.config.ts`) precaches only the app shell — EPUB files and covers live in IndexedDB and must **not** be added to `globPatterns` or runtime caching.

### State management

Zustand, one store per feature (`library-store.ts`, `reader-store.ts`), each wrapped in `devtools` middleware. Stores hold ephemeral UI/session state only (loaded chapter indices, current index, loading/error flags) — persisted data always round-trips through the storage service, never lives solely in a store. Store mutation logic lives in `actions/` files next to the store, not inline in components.

### Routing

`react-router-dom`, routes declared as constants in `utils/routes.ts` (`ROUTES.LIBRARY`, `ROUTES.READER`, `ROUTES.SETTINGS`); `/` and unmatched paths redirect to library.

### Testing

Vitest + jsdom. `src/tests/setup.ts` loads `fake-indexeddb/auto` (mocks IndexedDB globally for Dexie) and jest-dom matchers. `src/tests/fixtures/*.epub` are real binary EPUB fixtures covering edge cases (missing metadata, broken spine, nested OPF, invalid file, oversized book) — reuse these instead of constructing new EPUB blobs by hand. `src/tests/utils/` has shared helpers (`reset-test-db.ts`, `reset-store.ts`, `load-fixtures.ts`).

## UI

shadcn/ui config (`components.json`): style `base-lyra`, neutral base color, Phosphor icon library, path aliases `@/components`, `@/components/ui`, `@/utils/cn`. Path alias `@/*` → `./src/*` everywhere (tsconfig + vite).

Design review runs through the `impeccable` plugin (`/impeccable audit`, `colorize`, `layout`, `polish`, `typeset`, etc.) — invoke these for UI polish passes rather than freehanding a design review. Product/design context lives in `.agents/context/PRODUCT.md` and `.agents/context/DESIGN.md`. Every `/impeccable audit` run writes its full report to `AUDIT_REPORT.md` at the project root (tracked in git, overwritten each run) — distinct from `UI_REPORT.md`, which is gitignored and regenerated by the pre-commit hook from the mechanical detector on staged files.
