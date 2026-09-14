# Changelog

All notable changes to Librune are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project doesn't yet follow strict [SemVer](https://semver.org/) tagging (see `docs/RELEASE_CHECKLIST.md`), but `package.json`'s `version` is bumped on each dated release below.

## [Unreleased]

Nothing yet.

## [1.0.0] - 2026-09-14

The first documented release — everything built across Sprints 1-8, summarized here by feature area rather than by commit.

### Added

- **EPUB import & parsing** — client-side only, via JSZip + native `DOMParser` (no epub.js). Handles missing metadata, nested OPF paths, broken spines, and DRM detection (`META-INF/encryption.xml`) with a clear rejection message.
- **Reader** — a hand-built windowed iframe rendering engine: only `MAX_WINDOW_SIZE` chapters are ever mounted at once, so multi-hundred-chapter books stay fast. Scroll-based chapter detection, reading-position restore by content anchor (survives font/layout changes), table of contents navigation, external-link confirmation, and a chapter-transition live region for screen readers.
- **Reading progress** — per-book progress (chapter, scroll position, percent to one decimal place) saved on a debounce and flushed on backgrounding/navigation; reading status (unread / reading / finished) derived automatically, with a manual override (mark finished/unread, restart from the beginning).
- **Library** — grid view with search, sort, and filter (status, book length, language), a "continue reading" banner, and a "next in series" prompt after finishing a book in a series.
- **Full-text search** — an inverted index (one row per unique word per chapter) built on import and lazily backfilled for older books; metadata search needs no index and is never blocked by it. Content search shows a snippet and jumps straight to the matching chapter.
- **Series & collections** — series are auto-detected from Calibre-style OPF metadata (read-only); collections are user-created and freely editable. Both share one grouping schema and a merged Shelves view.
- **Backup & restore** — export the whole library (books, covers, reading progress, collections, and preferences) to a single archive file; restore merges by content hash, with a per-book conflict dialog when local and backed-up progress disagree.
- **Reading preferences** — light/dark/system theme (optionally applied to the reader too), three reader fonts, font size, line height, margins, and paragraph spacing, all live-applied without losing scroll position.
- **PWA & offline** — installable app shell precached via `vite-plugin-pwa`; EPUB files and covers deliberately excluded from the service-worker cache (they live in IndexedDB, not meant to be precached). Storage-quota estimate, a one-time persistent-storage request, and a pre-import quota check with a clear error when the device is full.
- **Cross-tab awareness** — opening the same book in two tabs surfaces a dialog; a newer save from another tab surfaces a reload prompt instead of silently overwriting progress.
- **Diagnostics** — a persistent, capped local error log (Settings → Storage), copyable or shareable, so a user can hand over what went wrong without needing devtools.
- **Accessibility** — WCAG 2.2 AA target: keyboard navigation and focus management across reader/library/modals, a documented (and mitigated) reader-iframe screen-reader limitation, and automated contrast regression coverage across both themes.
- **Performance regression guards** — generous-budget perf tests for EPUB parsing, library load at scale, search at index scale, groupings sort, bundle size, and a real-EPUB backup/export/search pipeline — all "catch a catastrophic regression," not tight gates.

### Fixed

Selected correctness/security fixes from the Sprint 8 hardening pass and the manual QA pass that followed it — see `docs/code-review-2026-08-30.md` and `docs/tasks/SPRINT-08-TASKS.md` for the full list:

- Reader active-chapter detection used nearest-top-edge instead of viewport coverage, losing the back half of every chapter on resume.
- EPUB zip paths with spaces or non-ASCII filenames failed to resolve chapters, covers, and TOC targets.
- Protocol-relative/root-relative CSS `url()` and external image references were neutralized before reaching the reader iframe (security).
- A book's reading status could get stuck showing "reading" at 100% on a short final chapter, and a freshly imported multi-chapter book could never register as "unread."
- Assorted memory-leak fixes: blob URLs revoked once per book teardown instead of per chapter-window slide; search indexing revoking each chapter's image blobs after reading text from them.
