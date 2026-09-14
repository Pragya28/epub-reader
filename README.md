# Librune

A local-first EPUB reader PWA. Books, covers, reading progress, collections, and search index all live entirely in IndexedDB (and OPFS where available) on your device — nothing is uploaded to a server, and the app works fully offline once installed.

Built with React 19 + TypeScript + Vite, with a hand-built windowed iframe rendering engine instead of epub.js.

## Features

- Import and read EPUB files entirely client-side (parsed with JSZip + native `DOMParser`, no epub.js)
- Library with metadata search, sort, filtering, reading status (unread/reading/finished), and per-book progress
- Full-text search across chapter content, with snippets and jump-to-match
- Series (auto-detected from EPUB metadata) and user-created collections
- Windowed chapter rendering — only a handful of chapters are ever mounted at once, so large books stay fast
- Installable as a PWA; the app shell is precached for offline use, with storage quota/persistence controls
- Backup & restore: export your whole library (books, covers, progress, collections, preferences) to one file and restore it later or on another device
- Cross-tab awareness: reading the same book in two tabs surfaces a conflict dialog instead of silently clobbering progress
- Light/dark theming and reader typography preferences (font, size, line height, margins, paragraph spacing)
- WCAG 2.2 AA accessibility target — see [`.agents/context/ACCESSIBILITY.md`](.agents/context/ACCESSIBILITY.md)

## Getting started

Requires [pnpm](https://pnpm.io) (pinned via `packageManager` in `package.json` — don't use npm/yarn) and Node ≥ 22.13.

```bash
pnpm install
pnpm dev
```

## Commands

```bash
pnpm dev            # start dev server
pnpm build          # tsc -b && vite build && bundle-size check
pnpm preview         # serve the production build locally
pnpm lint           # eslint .
pnpm test           # vitest (watch mode)
pnpm test:run       # vitest run (single pass, use in CI/scripts)
pnpm test:ui        # vitest with UI
pnpm test:e2e       # playwright (cross-device e2e, real browsers)
pnpm coverage       # vitest run --coverage
```

Run a single test file:

```bash
pnpm test:run src/features/reader/engine/windowing/__tests__/chapter-window.test.ts
```

Git hooks (husky) enforce quality gates:

- `pre-commit`: `lint-staged` (eslint --fix + prettier on staged files, plus `vitest related` for every test that imports a staged file)
- `pre-push`: `pnpm build` only — the full suite doesn't run locally; it runs in GitHub Actions (`.github/workflows/test.yml`) on every push to `main` and every PR (`Vitest` + `Playwright` jobs)

## Architecture

- `src/app/` — routing shell only (`router.tsx`, three screens: library / reader / settings)
- `src/features/{library,reader,preferences,pwa}/` — vertical slices, each with `store/`, `actions/`, `components/`, `types/`
- `src/services/{epub,storage,search,backup}/` — framework-agnostic infra: `epub/` parses EPUB files, `storage/` wraps Dexie/IndexedDB, `search/` builds and queries the full-text index, `backup/` owns the export/import archive format
- `src/components/` — shadcn/ui primitives plus cross-cutting toast/error-boundary components
- `src/shared/` — cross-feature utilities (logging, decorative ornaments)

See [CLAUDE.md](./CLAUDE.md) for the full architecture reference, including the reader's windowed rendering pipeline, the iframe's token-mirroring constraint, the Dexie storage schema, and the search/backup/collections design decisions. See [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) for the release process and [`CHANGELOG.md`](CHANGELOG.md) for what shipped when.

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Zustand · Dexie (IndexedDB) · JSZip · react-router-dom · Vitest · Playwright · vite-plugin-pwa
