# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user is the developer/owner themself — a personal, single-user reading tool, not a multi-tenant product. No accounts, no sharing, no other audiences to design for.

## Product Purpose

Librune is a local-first EPUB reader PWA. It lets the user open and read EPUB books with all data — book files, covers, reading progress — stored entirely in IndexedDB on-device. Success is a fast, reliable, distraction-free reading experience that works fully offline with no server dependency.

## Positioning

Two things a typical reader app (or a wrapper around epub.js) can't truthfully claim:

- **Local-first, no cloud, no account.** Nothing is ever uploaded; all persistence is IndexedDB via Dexie.
- **Custom-built rendering engine.** A hand-built, windowed iframe rendering pipeline (`features/reader/engine/`) — not epub.js — giving direct control over chapter virtualization, scroll-driven mount/unmount, and style handling instead of inheriting a third-party reader's constraints.

## Operating Context

Single-page PWA with three screens: library (book list), reader (windowed chapter view), settings. EPUB files are parsed client-side (JSZip + native DOMParser, no epub.js) and rendered into a sandboxed iframe (`srcdoc`) that does not inherit the parent app's CSS/fonts. Reading happens across sessions with position restore via a CFI-like element anchor.

## Capabilities and Constraints

- Must remain installable as a PWA and fully functional offline — no backend, no account layer, ever.
- Service worker precaches only the app shell; EPUB files/covers stay in IndexedDB and must never enter precache/runtime-cache globs.
- Reader iframe is a separate document from the parent app — shared design tokens (colors, fonts) must be hand-mirrored into the iframe renderer, not assumed to inherit.
- Only `MAX_WINDOW_SIZE = 5` chapters are mounted at once (performance constraint for large books).
- Stylesheets from EPUB files are sanitized before injection (expression(), javascript: URLs, @import stripped) — a security constraint on any reader-surface styling.

## Product Principles

- Local-first is non-negotiable: no feature should require a network call or introduce a hidden server dependency.
- The reading surface (iframe) is a separate rendering world from the app shell — every visual decision affecting it must be deliberately mirrored, not assumed.
- Personal tool, not a mass product: optimize for the owner's actual reading experience and taste over broad audience appeal or onboarding/marketing concerns.
- Performance at scale (large books, many chapters) is a first-class constraint, not an edge case.
