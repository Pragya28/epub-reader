# Impeccable Audit Report

Generated 2026-08-30, following the code-review-fix branch (`fix/code-review-findings`).

## Audit Health Score

| #         | Dimension                | Score     | Key Finding                                                                                                                                                    |
| --------- | ------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Accessibility            | 3         | The search field (`search-screen.tsx:172`) sets `outline-none` with no `focus-visible`/`focus-within` replacement — WCAG 2.4.7 on the screen's primary control |
| 2         | Performance              | 3         | `computeScrollAnchor` reads layout in a loop on every reader scroll frame, feeding only a 1.5 s-debounced save — layout thrashing on the hottest path          |
| 3         | Responsive Design        | 4         | Fluid auto-fill grids, capped reading column, no fixed-width breakage; smallest control is `icon-sm` (28px), clears WCAG 2.5.8                                 |
| 4         | Theming                  | 4         | Full token system, zero hard-coded hex in components, dark mode CI-verified (`token-contrast.test.ts`); a few off-ramp `text-xs` / `rounded-lg` in primitives  |
| 5         | Implementation Integrity | 4         | Detector over `src/app` + `src/components` + `src/features` returned 2 findings, both `font-size: 18px` inside an EPUB-renderer test fixture — false positives |
| **Total** |                          | **18/20** | **Excellent — minor polish**                                                                                                                                   |

## Implementation Integrity Verdict

**Pass.** `detect.mjs` produced 2 hits, both verified false positives: `font-size: 18px` in CSS-string assertions inside `src/features/reader/engine/renderer/__tests__/iframe-renderer.test.ts` (lines 36, 40) — test fixture data, not shipped UI. Down from 13 false positives in the 2026-08-28 pass (the `reader-iframe-styles.ts` font-name hits are gone from the detector's scope).

The implementation expresses a coherent, product-specific system. The "Bound Folio" identity — warm parchment palette, Cinzel/Literata serif pairing, graduated radius by role, constant soft ambient shadow — is thoroughly and consistently applied, and is fully documented in `DESIGN.md` with named rules that the code follows. No design-system drift, no repeated shortcuts, no decorative-vs-real-content confusion. This is a mature, well-tended codebase.

## Executive Summary

- Audit Health Score: **18/20** (Excellent — minor polish)
- Issues found: **0 P0, 1 P1, 1 P2, 3 P3**
- Since the 2026-08-28 pass:
  - **Resolved** — the P2 bundle-size finding. Sprint 8 Day 3 code-split the reader/search/settings routes out of the initial bundle; the largest chunk is now 230 kB gzip against a 310 kB budget, guarded by `check-bundle-size` in the pre-push hook.
  - **New** — the search-field focus gap (P1) and the per-frame scroll-anchor layout read (P2). Both predate this branch; neither is introduced by the code-review fixes.
- The `fix/code-review-findings` branch touches only two UI-adjacent files — `index.html` (a pre-paint theme-class script, no rendered change) and `confirm-delete-dialog.tsx` (an error-toast `catch`, no rendered change). Neither affects any score.

## Detailed Findings by Severity

### [P1] Search field has no visible focus indicator

- **Location**: `src/app/screens/search-screen.tsx:172` (the `<input>`), and its wrapper `<div>` at line 160
- **Category**: Accessibility
- **Impact**: The input carries `outline-none` with no `focus-visible:` ring, and its container has no `focus-within:` treatment. On mount the field is `autoFocus`ed, so the first-run case looks fine — but a keyboard user who Tabs to the Clear button or the back arrow and then Shift-Tabs back has no way to see that the search field is focused. This is the primary control of the entire screen.
- **WCAG/Standard**: 2.4.7 Focus Visible (Level AA) — also named in `ACCESSIBILITY.md` ("never `outline-none` without a replacement")
- **Recommendation**: Move the visible state to the container: `focus-within:ring-1 focus-within:ring-ring/50 focus-within:border-ring` on the wrapper `div` (it already reads as the field boundary), or restore a `focus-visible` ring on the input itself. Match the `Button` / `Input` primitive treatment.
- **Suggested command**: `/impeccable polish`

### [P2] Reader scroll handler reads layout in a loop every frame

- **Location**: `src/features/reader/engine/scroll/scroll-anchor.ts` (`computeScrollAnchor`), called from `src/features/reader/actions/save-reader-progress.ts:107` via the scroll handler in `use-reader-engine.ts`
- **Category**: Performance
- **Impact**: On every scroll frame, `computeReaderProgress` calls `computeScrollAnchor`, which runs `section.querySelectorAll("p,h1..h6,li,blockquote,td,pre,figcaption")` then a `getBoundingClientRect()` loop over every block already scrolled past — hundreds of forced layout reads per frame on a chapter read 80 % through. The `anchorPath` it produces is only consumed by `saveReaderProgress`, which is debounced 1500 ms; only `percent` is needed per frame (for the progress bar).
- **WCAG/Standard**: N/A (performance)
- **Recommendation**: Compute the anchor at save time inside the debounced `saveReaderProgress`, not per scroll tick. The per-frame path then only needs the cheap document-height / scrollY math for `percent`.
- **Suggested command**: `/impeccable optimize`

### [P3] Off-ramp font sizes (Ramp-Only Rule)

- **Location**: `src/components/ui/tabs.tsx:59` (`text-xs`, renders on the library Books/Shelves tabs), `src/components/ui/toggle.tsx:7` (`text-xs`), `src/components/ui/input.tsx:12` (`text-xs`, renders on the collection name/rename sheet), `src/components/ui/empty.tsx:62,86` (`text-sm` / `text-xs`), `src/features/library/components/search-result-row.tsx:64` (`text-sm`, app component)
- **Category**: Theming
- **Impact**: `DESIGN.md`'s Ramp-Only Rule — "never Tailwind's built-in `text-sm` / `text-base` / `text-xs`, even in shadcn-generated primitives" — is violated in shipped surfaces. Low user impact (the text is legible), but it undermines the single-source type ramp and the `cn()` / tailwind-merge safety the rule exists to protect.
- **Recommendation**: Swap to the nearest `--text-*` step: `text-xs` → `text-ui-sm` (12px) or `text-meta` (11px); `text-sm` → `text-ui` (14px). Do it in the primitive so every consumer inherits it.
- **Suggested command**: `/impeccable typeset`

### [P3] Radius scale drift

- **Location**: `src/features/library/components/continue-reading-banner.tsx:50` (`rounded-lg`), `src/features/library/components/about-book-sheet.tsx:42` (`rounded-lg`), `src/features/library/components/collections/add-to-collection-sheet.tsx:53,55,72,87` (`rounded-md` on rows and a checkbox), `src/features/library/components/book-card/book-card.tsx:117` (`rounded-md` on the "more actions" button), `src/app/screens/search-screen.tsx:160` (`rounded-lg` on the search container)
- **Category**: Theming / Shapes
- **Impact**: `DESIGN.md`'s documented radius language is a 4-step scale — `sm` (controls), `md`, `xl` (content), `3xl` (sheets) — and the Object/Control Split says controls take `rounded-sm` and content objects take `rounded-xl`/`3xl`. `rounded-lg` is not a documented step; `rounded-md` on a button or a selectable row sits in neither half of the split. The inconsistency is small in degree (all values are soft) but recurring across ~6 components.
- **Recommendation**: Controls (`book-card` action button, `add-to-collection` rows) → `rounded-sm`. Content-ish objects (the continue-reading banner's inner tile, the about-book cover thumb, the search container) → `rounded-xl` or `rounded-md`, chosen deliberately, and add the step to `DESIGN.md` if `md` is meant to be in play.
- **Suggested command**: `/impeccable layout`

### [P3] `RadioGroupRow` has no focus-visible ring distinct from its checked state

- **Location**: `src/components/ui/radio-group.tsx:48` (`RadioGroupRow`), used by the theme selector and font selector in `features/preferences`
- **Category**: Accessibility
- **Impact**: The full-row radio target carries `outline-none` and only a `data-checked:ring` — there is no `focus-visible:ring`. In a standard radio group, arrow-key navigation couples focus and selection, so the focused row is normally also the checked row and the ring shows; the gap is narrow (forced-colors mode, or a click-then-keyboard sequence). Still, focus visibility should not depend on selection state.
- **WCAG/Standard**: 2.4.7 Focus Visible (Level AA)
- **Recommendation**: Add `focus-visible:ring-[1.5px] focus-visible:ring-ring focus-visible:ring-inset` to the `RadioGroupRow` class, alongside the existing `data-checked:` treatment.
- **Suggested command**: `/impeccable polish`

## Patterns & Systemic Issues

- **shadcn primitives not fully converted to the design system.** `tabs.tsx`, `toggle.tsx`, `input.tsx`, `empty.tsx` retain Tailwind-default `text-xs`/`text-sm` and `rounded-none`/`rounded-md`. They were generated by the CLI and only partially retrofitted. Each one that ships (Tabs, Input) should be swept to the `--text-*` ramp and the documented radius scale once, so the primitive layer stops being a source of drift.
- **Focus visibility is strong on the shared primitives (`Button`, `RadioGroupItem`) but has two hand-rolled exceptions** — the search input and `RadioGroupRow`. Both are cases where a container or a whole row is the target rather than a single element; the fix in both is a container-level `focus-within` / `focus-visible` ring.

## Positive Findings

- **Zero hard-coded hex colors** in any `src/features`, `src/components`, or `src/app` component. Every color routes through a token.
- **`prefers-reduced-motion` done right** — collapses to 1 ms (not a 0.01 ms kill), keeps `animation-iteration-count: 1`, `scroll-behavior: auto`, and all final states and color feedback. Exactly the "intentional alternative" the standard asks for.
- **Dark mode is CI-guarded.** `src/__tests__/token-contrast.test.ts` computes every rendered token pair's ratio in both themes and fails below the `ACCESSIBILITY.md` minimums — the cheapest possible regression guard, and it has caught real failures before (`--selected`).
- **The reader-a11y contract shipped.** Chapter-transition live region, `lang` on the iframe document, hidden chrome that stays tabbable and reveals on focus. The virtualization limitation is documented and accepted rather than silently failed.
- **Bundle discipline.** Route-level code splitting plus a `check-bundle-size` gate in the pre-push hook. The prior audit's only open finding is closed.
- **Detector is near-clean** — 2 test-fixture false positives, no real hits.

## Recommended Actions

1. **[P1] `/impeccable polish`** — restore a visible focus indicator on the search field (container `focus-within` ring) and add a `focus-visible` ring to `RadioGroupRow`.
2. **[P2] `/impeccable optimize`** — move `computeScrollAnchor` off the per-frame scroll path into the debounced `saveReaderProgress`.
3. **[P3] `/impeccable typeset`** — sweep `tabs.tsx` / `toggle.tsx` / `input.tsx` / `empty.tsx` / `search-result-row.tsx` onto the `--text-*` ramp.
4. **[P3] `/impeccable layout`** — reconcile `rounded-lg` / `rounded-md` usage with the documented radius scale and the Object/Control Split.
5. **[P3] `/impeccable polish`** — final pass once the above land.

> You can ask me to run these one at a time, all at once, or in any order you prefer.
>
> Re-run `/impeccable audit` after fixes to see your score improve.
