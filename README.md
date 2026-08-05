# Librune

A local-first EPUB reader PWA. Books, covers, and reading progress live entirely in IndexedDB on your device — nothing is uploaded to a server, and the app works fully offline once installed.

Built with React 19 + TypeScript + Vite, with a hand-built windowed iframe rendering engine instead of epub.js.

## Features

- Import and read EPUB files entirely client-side (parsed with JSZip + native `DOMParser`, no epub.js)
- Library with search, sort, filtering, and per-book reading progress
- Windowed chapter rendering — only a handful of chapters are ever mounted at once, so large books stay fast
- Installable as a PWA; the app shell is precached for offline use
- Light/dark theming and reader typography preferences (font, size, line height)

## Getting started

Requires [pnpm](https://pnpm.io) (pinned via `packageManager` in `package.json` — don't use npm/yarn).

```bash
pnpm install
pnpm dev
```

## Commands

```bash
pnpm dev            # start dev server
pnpm build          # tsc -b && vite build
pnpm lint           # eslint .
pnpm test           # vitest (watch mode)
pnpm test:run       # vitest run (single pass, use in CI/scripts)
pnpm test:ui        # vitest with UI
pnpm coverage       # vitest run --coverage
```

Run a single test file:

```bash
pnpm test:run src/features/reader/engine/windowing/__tests__/chapter-window.test.ts
```

Git hooks (husky) enforce quality gates on every commit and push:

- `pre-commit`: `lint-staged` (eslint --fix + prettier on staged files) then `pnpm test`
- `pre-push`: `pnpm build` then `pnpm test`

## Architecture

- `src/app/` — routing shell only (`router.tsx`, three screens: library / reader / settings)
- `src/features/{library,reader,preferences}/` — vertical slices, each with `store/`, `actions/`, `components/`, `types/`
- `src/services/{epub,storage}/` — framework-agnostic infra: `epub/` parses EPUB files, `storage/` wraps Dexie/IndexedDB
- `src/components/` — shadcn/ui primitives plus cross-cutting toast/error-boundary components
- `src/shared/` — cross-feature utilities (logging, decorative ornaments)

See [CLAUDE.md](./CLAUDE.md) for the full architecture reference, including the reader's windowed rendering pipeline, the iframe's token-mirroring constraint, and the Dexie storage schema.

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Zustand · Dexie (IndexedDB) · JSZip · react-router-dom · Vitest
