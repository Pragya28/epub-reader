# Sprint 5 — Task List (Gap Analysis vs Codebase)

Generated 2026-08-04 by comparing `docs/06 - Implementation/Sprint - 05 Theming & Typography.md` against the current codebase.

Legend: ✅ done · 🟡 partial · ❌ missing

---

# Already Complete (credit from prior sprints)

- **Reader-scoped preferences store** — `reader-preferences-store.ts` (Zustand + `persist`, localStorage key `reader-preferences`): `fontScale` (0.8–1.6), `lineHeight` (1.2–2.2), `theme` (`system`/`light`/`dark`). Applied into the iframe via `applyReaderPreferences()` in `use-reader-engine.ts`.
- **Reading Preferences sheet** — `reader-toolbar.tsx`, a bottom sheet exposing font-scale +/- and theme radio buttons, wired to the store above.
- **App-wide light/dark CSS tokens** — `src/index.css` defines a full `:root` token set plus a `@media (prefers-color-scheme: dark)` override block. This is OS-driven only; nothing lets a user override it independently of the OS, and it's disconnected from the reader's own `theme` preference.
- **Settings route** — `ROUTES.SETTINGS` exists, linked from the library header gear icon, and `settings-screen.tsx` renders (currently a stub: `<div>Settings Screen</div>`).

---

## Day 1 — Theme System

1. 🟡 **Light/Dark theme tokens** — exist in `src/index.css`, but driven solely by `prefers-color-scheme`; no explicit Light/Dark/System selector for the _app shell_ (library, settings). Only the reader iframe has a `theme` preference (#already-complete), and it doesn't propagate outside the iframe.
2. ❌ **Centralized theme system** — no single source of truth applies a theme across the whole app. Need an app-level theme store (or extend `reader-preferences-store` scope) that sets a `data-theme` attribute on `<html>`/`<body>`, mirrored the way `iframe-renderer.ts` already mirrors tokens into the reader iframe (per CLAUDE.md's existing note on keeping those two in sync).
3. ❌ **Apply theme across application UI** — library, settings, and any dialogs/sheets currently only follow the OS preference; need to follow the explicit user selection once #2 exists.
4. 🟡 **Persist selected theme** — reader's `theme` field already persists via `zustand/persist`; an app-wide equivalent needs the same treatment (new store or reuse).
5. ❌ **Reader/library consistency** — today the reader's theme choice ("Light"/"Dark"/"System" in `reader-toolbar.tsx`) has no visible effect outside the iframe, so switching it while looking at the header/footer chrome is inconsistent. Needs reconciling once app-wide theme lands.

## Day 2 — Reading Preferences

6. ✅ **Font size** — `fontScale` in `reader-preferences-store.ts`, exposed via +/- buttons in `reader-toolbar.tsx`.
7. ✅ **Line height** — `lineHeight` in `reader-preferences-store.ts` (present in store; confirm UI control exists in `reader-toolbar.tsx` beyond font size — only font scale and theme were visible in the first 60 lines read, verify remaining ~76 lines).
8. ❌ **Font family** — no field in `reader-preferences-store.ts`, no UI control. `index.css` defines `--font-reading` as a single fixed value; needs to become user-selectable (e.g. serif/sans/dyslexic-friendly options) and threaded into `iframe-renderer.ts`'s mirrored tokens.
9. ❌ **Paragraph spacing** — no field, no UI control.
10. ❌ **Reading margins** — no field, no UI control.
11. 🟡 **Apply preferences without breaking EPUB formatting** — the existing `fontScale`/`lineHeight`/`theme` pipeline already sanitizes injected EPUB CSS (`@import`, `expression()`, `javascript:` stripped per CLAUDE.md); new preferences (font family, spacing, margins) need to follow the same injection path in `iframe-renderer.ts` rather than a new one.
12. ❌ **Persist new preferences** — extend the existing `persist` middleware config once font family/spacing/margins are added as store fields (mechanical, same pattern as #6/#7).

## Day 3 — Reader Chrome Behaviour

13. ❌ **Single tap toggles header/footer** — `reader-screen.tsx`'s `<header>`/`<footer>` (`folio-header` class) are always rendered, no visibility state or tap handler on `<main>`/`ReaderFrame`.
14. ❌ **Scroll down hides chrome / scroll up reveals chrome** — no scroll listener exists on the reader's scroll container (`detect-visible-chapter.ts` tracks visible chapter for progress, not chrome visibility).
15. ❌ **Keep chrome visible while overlays are open** — no chrome-visibility state to guard yet; will need to check against `TocDrawer`/`ReaderToolbar` sheet open state and `ExternalLinkDialog` open state once #13 exists.
16. ❌ **Prevent accidental toggles during text selection / image interaction / link activation** — no tap-target logic exists yet since there's no tap toggle at all.
17. ❌ **Smooth fade/slide animations** — n/a until chrome visibility state exists.

## Day 4 — Library Chrome Behaviour

18. ❌ **Hide header while scrolling down / reveal on scroll up** — `library-screen.tsx`'s `<header>` is `sticky top-0`, always visible; no scroll listener.
19. ✅ **Preserve search/sort/filter state** — already done in Sprint 4 (`library-filter-store.ts`, Zustand `persist`), unaffected by this day's scroll work as long as the header logic doesn't touch that store.
20. 🟡 **Integrate with bottom sheets/dialogs** — `LibraryFilterSheet` already exists and works independently of header visibility; needs verifying once scroll-hide is added that the sheet still opens correctly with a hidden header.
21. ❌ **Smooth transitions** — n/a until scroll-hide state exists.

## Day 5 — UI Polish

22. 🟡 **Typography hierarchy** — `.section-title` token exists (used for library `<h1>`, added Sprint 4 Day 6 #26) but no comprehensive type ramp audit has been done for Sprint 5's scope (settings screen, reader preferences sheet, dialogs). **`AUDIT_REPORT.md` [P2]** (2026-08-04 run) ✅ fixed: 7 literal font sizes off the DESIGN.md ramp. `book-card.tsx:57` (10px) and `book-cover.tsx:33` (9px) snapped to the existing `text-meta` (11px) step. `book-cover.tsx:44` and `continue-reading-banner.tsx:38` (15px, recurring in two independent places — a genuine "compact title" role, not accidental drift) promoted to a new documented step, `--text-title-sm: 15px` (`src/index.css`), added to DESIGN.md's typography ramp and Hierarchy section as **Title Small**. `continue-reading-banner.tsx:35,44` (10px) also snapped to `text-meta`. Detector re-run confirms 0 remaining real findings. _(done 2026-08-04)_
23. ❌ **Settings screen content** — currently a bare stub (`<div>Settings Screen</div>`); this is where Day 1's theme selector and Day 2's typography controls likely surface at the app level (as opposed to reader-only), per the sprint's "final visual identity" goal.
24. 🟡 **Spacing consistency / component transitions / responsive layouts** — no known regressions, but no dedicated audit pass has been run for this sprint; run `/impeccable audit` per the "Starting a new sprint" process in CLAUDE.md to get a fresh baseline once Days 1–4 land (new UI surfaces should exist before auditing them).

## Day 6 — Integration & Accessibility Foundations

25. ❌ **Integrate theme and preference systems** — depends on Days 1–2 landing first (app theme store + expanded reader preferences).
26. 🟡 **Focus states / contrast consistency** — no dedicated pass yet on contrast; new themeable-color work still pending Day 1. **`AUDIT_REPORT.md` [P1]** (2026-08-04 run) ✅ fixed: added a global `@media (prefers-reduced-motion: reduce)` override in `src/index.css` (1ms animation/transition durations, `scroll-behavior: auto`) — covers `button.tsx` press/hover, `import-book-fab.tsx`, pulse loaders, `book-card.tsx` shadow transitions, and `tw-animate-css` sheet slide-ins uniformly. State changes (color, final position) still render immediately since only duration is zeroed, not the end state — satisfies the audit's warning against a "kill that destroys useful feedback." _(done 2026-08-04)_
27. ❌ **Validate preference interactions across Reader and Library** — blocked on Day 1/4 landing.

## Day 7 — Hardening

28. ❌ **Performance, cleanup, docs, regression pass** — standard end-of-sprint pass, do last per existing sprint pattern (see Sprint 4 Day 7 for the shape: full test suite + lint + build + targeted perf test if a new hot path was added, e.g. scroll listeners in Day 3/4).

---

# Deferred (carried over from Sprint 4, now in-scope territory)

- **`prefers-reduced-motion` support** (flagged in `tasks/SPRINT-04-TASKS.md` Deferred section) — Sprint 4 explicitly deferred this here because Sprint 5 is "where user customization through theming and typography becomes the primary focus." Fold into Day 6 (Accessibility Foundations) rather than treating as new scope.
- **Font sizes drifted off the DESIGN.md type ramp** (also flagged in Sprint 4) — fold into Day 5 (UI Polish) typography hierarchy pass.

---

# Suggested Sequencing

Day 1 (app theme system) should land before Day 6 (integration) and ideally before Day 5 (polish/audit), since polishing against inconsistent theming would need redoing. Day 2 (reading preferences) is independent of Day 1 and can run in parallel — it only touches `reader-preferences-store.ts` and `iframe-renderer.ts`. Days 3 and 4 (reader chrome, library chrome) are both pure scroll/tap-interaction work in separate features and can run in parallel with each other and with Days 1–2. Day 5's `/impeccable audit` should run _after_ Days 1–4 produce new UI (theme selector, settings screen content, chrome animations) so the audit reviews real surfaces, not stubs — matches the "Starting a new sprint" process order in CLAUDE.md (spec → gap list → audit → reconcile). Day 6 depends on Days 1–4. Day 7 is integration/hardening once everything else lands.
