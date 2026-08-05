# Sprint 5 — Task List (Gap Analysis vs Codebase)

Generated 2026-08-04 by comparing `docs/06 - Implementation/Sprint - 05 Theming & Typography.md` against the current codebase.

Legend: ✅ done · 🟡 partial · ❌ missing

---

# Already Complete (credit from prior sprints)

- **Reader-scoped preferences store** — was `reader-preferences-store.ts` (Zustand + `persist`, localStorage key `reader-preferences`): `fontScale` (0.8–1.6), `lineHeight` (1.2–2.2), `theme` (`system`/`light`/`dark`). Applied into the iframe via `applyReaderPreferences()` in `use-reader-engine.ts`. **2026-08-05: being moved into `features/preferences/store/preferences-store.ts`** — see Day 1/Day 2 below.
- **Reading Preferences sheet** — `reader-toolbar.tsx`, a bottom sheet exposing font-scale +/- and theme radio buttons, wired to the store above.
- **App-wide light/dark CSS tokens** — `src/index.css` defines a full `:root` token set plus a `@media (prefers-color-scheme: dark)` override block. This is OS-driven only; nothing lets a user override it independently of the OS, and it's disconnected from the reader's own `theme` preference.
- **Settings route** — `ROUTES.SETTINGS` exists, linked from the library header gear icon, and `settings-screen.tsx` renders (currently a stub: `<div>Settings Screen</div>`).
- **Figma reference** — accessible (Figma MCP connected 2026-08-05, despite an earlier session-start reminder saying it needed authorization). Two nodes referenced from `https://www.figma.com/design/ohsm1arYYCfzARM2RuNBI5/Librune`:
  - `node-id=88-178` ("Settings - Immersive Layout") — the overall settings-screen layout: header, sectioned rounded cards (Atmosphere / Typography / Storage), segmented Visual Theme control, toggle row.
  - `node-id=90-723` ("Typography") — the font-selection widget specifically: a bordered list of font-name rows with an inset-ring + checkmark on the selected row, plus a live preview card (pangram + alphabet string).
  - **Resolution: written spec is the source of truth for content/behavior, Figma is the source for layout only** (explicit user direction, since the two disagreed in several places). Conflicts found and how each was resolved:
    - Theme options: Figma shows Light/Sepia/Dark (no System); spec says System/Light/Dark → **spec wins**, no Sepia theme.
    - The Figma toggle is labeled "Immersion Mode / Focus on the narrative" (reads as a distraction-free-reading feature); spec's toggle is theme-inheritance ("apply theme to reader") → **spec wins**, switch controls `applyThemeToReader`, not immersion/focus mode.
    - Figma's font picker names the app's own brand fonts (Literata/Cinzel/Jakarta) → **rejected per explicit follow-up direction** ("they are app fonts"); replaced with four reading-purposed fonts researched separately (Literata/Lora/DM Sans/Atkinson Hyperlegible — see item #8 below). The row-list-plus-preview _widget layout_ from this frame was kept.
    - Figma's "Storage" section (Library Sync / Local Cache) doesn't apply to this app (no backend, no sync feature) — not built.
    - Figma's "Scale" (font size) slider in the Typography frame was not copied into Settings — font size stays a reader-only preference per the spec's ownership split.

---

## Day 1 — Theme System

**Concrete plan (2026-08-05, cross-validated against user-specified preferences model):** consolidate into a new `src/features/preferences/` slice — `store/preferences-store.ts` replaces `reader/store/reader-preferences-store.ts` entirely (moved, not duplicated). Store fields split by level:

- **User-level:** `theme` (`system`/`light`/`dark`), `applyThemeToReader` (bool switch — when `true`, the reader follows `theme` and hides its own theme control; when `false`, the reader uses its own `readerTheme`), `readerFont` (shared with reader — see Day 2).
- **Reader-only:** `readerTheme` (used only when `applyThemeToReader` is `false`), `fontScale`, `lineHeight`, `margins`, `paragraphSpacing`.
- `getEffectiveReaderTheme()` selector resolves which theme value the reader actually renders.

1. 🟡 **Light/Dark theme tokens** — exist in `src/index.css`, but driven solely by `prefers-color-scheme`; no explicit Light/Dark/System selector for the _app shell_ (library, settings). Only the reader iframe has a `theme` preference (#already-complete), and it doesn't propagate outside the iframe.
2. ❌ **Centralized theme system** — `useApplyTheme()` hook (`features/preferences/hooks/`) subscribes to `preferencesStore.theme` and toggles a `dark`/`light` class on `<html>` (`system` removes both, falling back to the existing `@media (prefers-color-scheme)` block). `index.css` needs a `.dark { ...dark token values... }` block added (currently only exists inside the media query) and the media query rescoped to `:root:not(.light):not(.dark)` so an explicit choice always wins over the OS. `@custom-variant dark (&:is(.dark *));` already exists in `index.css` (unused shadcn boilerplate) — this is exactly what it's for.
3. ❌ **Apply theme across application UI** — wired once via `useApplyTheme()` called at the `app.tsx` root; library, settings, and all dialogs/sheets inherit through the same CSS custom properties, no per-screen work needed.
4. 🟡 **Persist selected theme** — unified store persists as one localStorage entry, key `librune-preferences` (renamed from `reader-preferences` — acceptable one-time reset for a single-user local tool, no migration needed per the existing Dexie-reindex precedent in CLAUDE.md).
5. ❌ **Reader/library consistency** — resolved by `applyThemeToReader`: when `true` (default), the reader mirrors the app theme and its own theme control is hidden from `reader-toolbar.tsx`; when `false`, the reader keeps an independent `readerTheme` choice, matching the user's explicit preferences model rather than always forcing one or the other.

## Day 2 — Reading Preferences

6. ✅ **Font size** — `fontScale`, moved into `features/preferences/store/preferences-store.ts`, unchanged range/step, still exposed via +/- buttons in `reader-toolbar.tsx`.
7. ✅ **Line height** — `lineHeight`, moved into the same store, unchanged range/step.
8. ❌ **Font family** — `readerFont` field (shared user-level preference, editable from both Settings and `reader-toolbar.tsx` via one reusable `FontSelector` component) plus a curated `READER_FONTS` list (`features/preferences/constants/reader-fonts.ts`): **Literata** (existing self-hosted serif, default), **Lora** (serif alternative), **DM Sans** (general-purpose reading sans), **Atkinson Hyperlegible** (accessibility-oriented sans — disambiguates similar characters like B/8, O/0, 1/I/l). Chosen over reusing the app's own Cinzel/Jakarta brand fonts per explicit direction — reading fonts and identity fonts serve different jobs. All four self-hosted (latin + latin-ext, `public/fonts/{literata,lora,dm-sans,atkinson-hyperlegible}/`, weight 400 only — no font-weight scale; see decision note below) for the same offline-first-read reliability `READER_FONTS_STYLE` already documents for Literata. Threaded into the iframe via a new `--reading-font-family` custom property, replacing the hardcoded `"Literata", serif !important` in `buildReaderBaseStyle()`.
   - **Decision (2026-08-05): no font-weight scale.** Considered and rejected — not a control most reading apps expose (unlike size/line-height), would require self-hosting 2+ extra weights per font (8+ more files) for a preference few readers touch, and wasn't in the original spec. Eye-strain concerns are better served by font _choice_ (e.g. Atkinson Hyperlegible) than a weight slider. Only weight 400 is self-hosted per font; bold/italic fall back to browser synthesis, acceptable for secondary reading font choices.
9. ❌ **Paragraph spacing** — **2026-08-05: added back to the plan** (originally left out as not part of the user-specified preferences model; user asked for it to be included). New `paragraphSpacing` field (0–24px, step 4, default 8), reader-only (not exposed in Settings, same as margins/font size/line height). Applied via a new `--reading-paragraph-spacing` custom property, set as `margin-bottom` on `<p>` inside the reader iframe's base style — same injection path as the other reader-only fields, not a new mechanism.
10. ❌ **Reading margins** — new `margins` field (8–48px, step 8, default 16 — matches the iframe body's current hardcoded `padding: 0 16px`), reader-only (not exposed in Settings), applied via a new `--reading-margin` custom property.
11. 🟡 **Apply preferences without breaking EPUB formatting** — font family, margins, and paragraph spacing all follow the exact same `applyReaderPreferences()` CSS-custom-property injection path as the existing `fontScale`/`lineHeight`/`theme`, not a new one.
12. ❌ **Persist new preferences** — covered by the same unified `persist` config as #4 above — no separate persistence work.

## Day 1/2 — Settings Screen (moved up from Day 5)

12a. 🟡 **Settings screen build-out** — supersedes Day 5 item #23 below (kept there only as a cross-reference). `settings-screen.tsx`'s stub becomes the functional home for the Day 1 theme controls: **Appearance** section (`ThemeSelector` bound to `theme`, `Switch` for `applyThemeToReader`) and **Reading** section (`FontSelector` bound to the shared `readerFont`). Header follows the existing `library-author-screen.tsx` pattern (`folio-header` + back button); theme control follows `reader-toolbar.tsx`'s existing `THEME_OPTIONS` button-group pattern; `switch.tsx` (already in `components/ui/`) reused as-is for the toggle. **Font selector visual design follows the user-provided Figma reference** (`node-id=90-723`, "Typography" frame) instead of a button-group: a bordered list of font-name rows (selected row gets an inset ring + checkmark, `lucide-react`'s `Check`), each row rendered in its own font via inline `style={{ fontFamily }}`, plus a live preview card below (pangram + alphabet string) — `features/preferences/components/font-selector.tsx`. Per "written spec as source of truth, Figma as layout" direction: content/behavior (which fields exist, the four curated fonts) comes from the spec; only the row-list-plus-preview visual pattern comes from Figma. The Figma frame's "Scale" slider section was deliberately not copied — font size stays a reader-only preference per the spec's ownership split, not a Settings-level control. _(font-selector.tsx done 2026-08-05; theme-selector.tsx, switch wiring, and the surrounding settings-screen.tsx layout still open)_

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
23. ➡️ **Settings screen content** — moved to Day 1/2 item #12a above (the functional build now happens alongside the theme/preference system it exposes, rather than as a later polish pass). Only a cosmetic pass on that build remains here, once it exists.
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

Day 1 and Day 2 now land together (2026-08-05) — both route through the same new `features/preferences` store and the same Settings screen build (#12a), so splitting them further would just mean touching the same files twice. That combined work should land before Day 6 (integration) and ideally before Day 5 (polish/audit), since polishing against inconsistent theming would need redoing. Days 3 and 4 (reader chrome, library chrome) are both pure scroll/tap-interaction work in separate features and can run in parallel with each other and with Days 1–2. Day 5's `/impeccable audit` should run _after_ Days 1–4 produce new UI (theme selector, settings screen content, chrome animations) so the audit reviews real surfaces, not stubs — matches the "Starting a new sprint" process order in CLAUDE.md (spec → gap list → audit → reconcile). Day 6 depends on Days 1–4. Day 7 is integration/hardening once everything else lands.
