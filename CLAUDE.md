# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working style

Always work in ponytail mode (full intensity) in this repo — favor the simplest solution that works, stdlib/native/existing-dependency first, no speculative abstractions.

When executing a superpowers plan in this repo, default to: a feature branch in the current directory (not an isolated worktree), and inline execution (not subagent-driven-development) — unless the user asks for isolation or subagent dispatch for that specific task.

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
- `src/features/{library,preferences,reader}/` — vertical slices, each with `store/`, `actions/`, `components/`, `types/`. `reader/` additionally owns `engine/` (custom chapter rendering pipeline), `hooks/`, and `utils/`; `preferences/` additionally owns `hooks/` and `constants/`.
- `src/services/{epub,storage}/` — framework-agnostic infra. `epub/` parses EPUB files; `storage/` wraps Dexie/IndexedDB.
- `src/components/` — shadcn/ui primitives (`ui/`) plus cross-cutting `toast/` and `error-boundary/`.
- `src/shared/` — cross-feature utilities not tied to one layer (`logger/`, `ornaments.ts` — decorative SVGs injected into the reader iframe).
- `src/constants/`, `src/utils/` — pure data tables / generic helpers (`cn.ts`, `routes.ts`, `create-book-id.ts`, `hash.ts`).

Tests are colocated in `__tests__/` next to the code they cover, not centralized.

`store` in a filename means a Zustand store specifically (e.g. `reader-store.ts`) — don't use it for other kinds of modules (e.g. a Dexie-backed data module is `search-index.ts`, not `search-index-store.ts`).

Don't re-export one module's functions through another for convenience (e.g. `services/search/search-service.ts` re-exporting `services/search/search-index.ts`'s functions) — import each function directly from the module that defines it.

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

When a UI primitive doesn't exist yet in `src/components/ui/` (a switch, radio group, slider, etc.), check whether shadcn has it first — `pnpm dlx shadcn@latest search @shadcn <name>` — and run `pnpm dlx shadcn@latest add <name>` to generate it there before reaching for the underlying Base UI package (`@base-ui/react/*`) directly in feature code. Feature components should import from `@/components/ui/*`, not from `@base-ui/react/*` — that's what happened with `button.tsx` and `switch.tsx`, and `radio-group.tsx` should follow the same path. If the generated component's default variant doesn't fit (e.g. shadcn's `RadioGroupItem` is a dot-plus-label pattern, not a full selectable row), extend the same generated file with an additional variant rather than bypassing it — see `RadioGroupRow`/`RadioGroupRowIndicator` alongside `RadioGroupItem` in `radio-group.tsx` for the pattern. Only import a Base UI package directly when shadcn has no equivalent at all (confirmed via `search`) — e.g. `@base-ui/react/number-field` has no shadcn wrapper, so `stepper-row.tsx` composes it directly, hand-styled with `button.tsx`'s existing `buttonVariants`. Any file that needs `@base-ui/react/number-field` belongs in `src/components/ui/` (like `stepper-row.tsx`), never imported straight into a feature component — same reasoning as the shadcn-generated wrappers above, just for the one primitive shadcn doesn't cover.

Design review runs through the `impeccable` plugin (`/impeccable audit`, `colorize`, `layout`, `polish`, `typeset`, etc.) — invoke these for UI polish passes rather than freehanding a design review. Product/design context lives in `.agents/context/PRODUCT.md` and `.agents/context/DESIGN.md`. Every `/impeccable audit` run writes its full report to `AUDIT_REPORT.md` at the project root (tracked in git, overwritten each run) — distinct from `UI_REPORT.md`, which is gitignored and regenerated by the pre-commit hook from the mechanical detector on staged files.

Accessibility contract (target conformance level, contrast/focus/motion/target-size minimums, known reader-engine gaps) lives in `.agents/context/ACCESSIBILITY.md` — hand-maintained, unlike DESIGN.md it is never regenerated by `/impeccable document`. Check it before any color, focus, or reader-interaction change; its contrast minimums are guarded in CI by `src/__tests__/token-contrast.test.ts`.

## CSS / Styling

Within a flex/grid container, space children with the container's `gap` utility, not per-child margins (`mt-*`/`mb-*`/`ml-*`/`mr-*`). Margins on individual children make spacing implicit and inconsistent to change; a single `gap-*` on the parent is the one place to look and the one place to edit.

## Starting a new sprint

When kicking off work on a new sprint, follow this process:

1. Read the sprint spec from `docs/06 - Implementation/Sprint - NN <name>.md`.
2. Compare it against the current codebase and write `tasks/SPRINT-NN-TASKS.md` — a gap list (✅ done / 🟡 partial / ❌ missing) of what the spec asks for vs. what already exists, following the format of prior `tasks/SPRINT-*-TASKS.md` files.
3. Run `/impeccable audit` to get a fresh `AUDIT_REPORT.md`.
4. Reconcile the audit findings into the sprint task list:
   - If a finding overlaps a task already in the list (e.g. a dead button that's really an unbuilt feature), cross-reference it there instead of duplicating.
   - If a finding is in-scope for this sprint's surfaces/days but not yet listed, add it as a new task under the relevant day.
   - If a finding is out of scope (project-wide, or squarely belongs to a later sprint's stated focus), add it to a "Deferred" section with a one-line reason.

## Sprint status documents

When asked to create a sprint status document (e.g. `Sprint - NNB – Implementation Status.md`) for the current/most recent sprint:

1. Write it to `docs/06 - Implementation/Sprint - NNB – Implementation Status.md`, following the format of prior `Sprint - NNB` files (grouped by architectural area, each item with a description, "Architectural Areas", and an "Originally Planned" line).
2. Only include items that were **not specifically planned** or are **completely new** — i.e. the sprint doc didn't call for that exact mechanism, or it wasn't in the sprint doc at all. Leave out anything that was implemented as the sprint spec literally described it; those don't need a status entry.
3. If the sprint is still in progress when the doc is created, say so explicitly in the intro (don't imply the sprint is done), and **remind the user to update the document once the sprint actually finishes** — later days may add more unplanned/new items worth folding in.

<!-- code-review-graph MCP tools -->

## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact**: `get_impact_radius_tool` instead of manually tracing imports
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships**: `query_graph_tool` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool                             | Use when                                               |
| -------------------------------- | ------------------------------------------------------ |
| `detect_changes_tool`            | Reviewing code changes — gives risk-scored analysis    |
| `get_review_context_tool`        | Need source snippets for review — token-efficient      |
| `get_impact_radius_tool`         | Understanding blast radius of a change                 |
| `get_affected_flows_tool`        | Finding which execution paths are impacted             |
| `query_graph_tool`               | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes_tool`     | Finding functions/classes by name or keyword           |
| `get_architecture_overview_tool` | Understanding high-level codebase structure            |
| `refactor_tool`                  | Planning renames, finding dead code                    |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes_tool` for code review.
3. Use `get_affected_flows_tool` to understand impact.
4. Use `query_graph_tool` pattern="tests_for" to check coverage.
