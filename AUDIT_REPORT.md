# Impeccable Audit Report — Librune

Generated 2026-08-07 (re-run after Sprint 5 Days 3–5: reader/library chrome behavior, the Antique Gold accent + `rounded-sm` shape pass, and two live-verified chrome bug fixes). Codebase-wide technical audit (`/impeccable audit`), not a design critique. Scope: `src/` (all `.tsx` app/feature/UI files + `index.css`). Detector run: `detect.mjs --json` across every non-test `.tsx` file plus `index.css` → 0 findings.

---

## Audit Health Score

| #         | Dimension                | Score     | Key Finding                                                                                                                                                    |
| --------- | ------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Accessibility            | 3         | New `--selected` accent token falls below WCAG 1.4.11 non-text contrast (3:1) in light mode — 2.65–2.77:1 measured on the radio-row ring/checkmark             |
| 2         | Performance              | 3         | Library's derived book list (enrich→sort→filter→search) recomputes on every render with no memoization, including on scroll-driven header toggles              |
| 3         | Responsive Design        | 4         | Fluid `auto-fill` grid, touch targets ≥24px (meets WCAG 2.2 AA), no fixed-width breakpoints found                                                              |
| 4         | Theming                  | 4         | Full CSS custom-property token system; zero hardcoded hex colors in component code; new tokens (`warm-accent`, `selected`) documented and used consistently    |
| 5         | Implementation Integrity | 4         | Coherent system maintained through a real shape-language change (sharp→`rounded-sm`) and a new accent-color family, with named rules kept in sync in DESIGN.md |
| **Total** |                          | **18/20** | **Excellent — minor polish**                                                                                                                                   |

**Previous score: 19/20 (2026-08-04) → 18/20.** Not a regression in quality — the previous run predates Sprint 5 Days 3–6 entirely (no chrome behavior, no accent colors, no shape change existed yet to audit). This run found one real, previously-untested contrast gap in the new selection-accent token and one real, previously-nonexistent performance gap now that scroll-driven state updates touch the book list. Both are P2, neither blocks release.

---

## Implementation Integrity Verdict

**Pass.** The codebase still expresses one coherent, product-specific system after two real changes this sprint — the "Bound Folio" identity's control shape moved from strictly sharp (`rounded-none`) to a disciplined `rounded-sm`, and a new Antique Gold accent family (`warm-accent`, fixed; `selected`, theme-tuned) was added — and both changes are fully reflected in `.agents/context/DESIGN.md` (Shapes, Colors/Accent, two new Named Rules), not just in code. The detector returned zero findings across every non-test component and `index.css`. No generic/interchangeable UI found; no drift between what DESIGN.md claims and what the code does.

---

## Executive Summary

- Audit Health Score: **18/20** (Excellent), down from 19/20 as new surfaces entered scope
- Total issues found: 0 P0, 0 P1, 2 P2, 1 P3
- Top findings:
  1. **[P2] `--selected` light-mode contrast** — the amber selection-state ring/checkmark (font-picker radio rows) measures 2.65–2.77:1 against its typical surfaces, below the 3:1 WCAG 1.4.11 minimum for non-text UI indicators. Dark mode's value (`#e0ac52`) is fine at 8.14:1 — only light mode needs retuning.
  2. **[P2] Unmemoized library list pipeline** — `use-library-screen.ts` re-derives the enrich→sort→filter→search chain on every render, including the header-visibility toggles the Day 4 scroll listener now fires every ~8px of scroll. Invisible today with a handful of books; will show up as scroll jank as libraries grow.
  3. **[P3] Two scroll listeners, both unthrottled** — the reader (`use-reader-engine.ts`) and library (`use-library-screen.ts`) scroll handlers both run on every native `scroll` event rather than being rAF-batched. Each does cheap work today (no forced layout reads beyond `scrollY`), so no measured jank — flagged as a watch-item since this is now the second listener of this shape added this sprint, not because either one is currently a problem.
- Recommended next steps: retune `--selected`'s light-mode value (small, isolated CSS change); memoize the library derivation pipeline (`useMemo`, no behavior change). Neither is urgent — both are pre-existing-pattern polish, not new-code defects.

---

## Detailed Findings by Severity

### [P2] `--selected` token fails non-text contrast in light mode

- **Location**: `src/index.css` (`--selected: #b8862e` under `:root`), consumed by `src/components/ui/radio-group.tsx` (`RadioGroupRow`'s `data-checked:ring-selected`) and `src/features/preferences/components/font-selector.tsx` (the selected-row checkmark, `text-selected`)
- **Category**: Accessibility
- **Impact**: In light mode, the ring and checkmark that indicate "this typeface is currently selected" in Settings' font picker are close to imperceptible against their surrounding surface for users with low vision — the only cue is a subtle hue shift at sub-threshold contrast, not a genuinely visible boundary.
- **WCAG/Standard**: 1.4.11 Non-text Contrast (AA) — requires ≥3:1 for UI component boundaries and state indicators. Measured: 2.65:1 against `surface-high` (`#f0e8d4`), 2.77:1 against `card` (`#f5edd9`). Dark mode's `--selected` (`#e0ac52`) measures 8.14:1 against `card`-dark and is not affected.
- **Recommendation**: Darken the light-mode `--selected` value until it clears 3:1 against both `card` and `surface-high` (a shift of roughly one step toward the existing `ring-umber`/`secondary-sand-foreground` territory should be enough — verify with a contrast calculation before committing, not by eye). No structural change needed; this is a single hex value.
- **Suggested command**: `/impeccable colorize` (targeted retune, not a new palette pass)

### [P2] Library book list recomputed without memoization on every render

- **Location**: `src/features/library/hooks/use-library-screen.ts` — `enriched`, `sorted`, `filtered`, `visibleBooks` are all derived inline (`.map()`/`.filter()`/`.sort()`) on every call, with no `useMemo`; `src/features/library/components/book-grid.tsx` and `book-card/book-card.tsx` are plain function components, not wrapped in `React.memo`
- **Category**: Performance
- **Impact**: Every state change in `LibraryScreen` — including the Day 4 scroll-driven header-visibility toggle, which now fires on any 8px+ scroll delta — re-runs the full enrich→sort→filter→search pipeline and allocates fresh array/object references for every book, which cascades a full re-render of every `BookCard` regardless of whether that book's own data changed. Not observable yet with a small personal library, but it's a real cost that scales with library size and now fires on a much hotter path (scroll) than it used to (only on data/filter changes).
- **WCAG/Standard**: n/a — performance, not an accessibility standard
- **Recommendation**: Wrap the derivation chain in `useMemo`, keyed on `books`/`filters`/`sortBy`/`query` (`headerVisible` must not be a dependency — that's the whole point). Consider `React.memo` on `BookCard` as a second, optional layer once the memoized list itself stops allocating new book objects unnecessarily.
- **Suggested command**: `/impeccable optimize`

### [P3] Reader and library scroll listeners are unthrottled

- **Location**: `src/features/reader/hooks/use-reader-engine.ts` (`handleScroll`) and `src/features/library/hooks/use-library-screen.ts` (`handleScroll`)
- **Category**: Performance
- **Impact**: Both listeners run synchronously on every native `scroll` event rather than being batched to `requestAnimationFrame`. Each currently does cheap work (a `scrollY` read, a delta comparison, occasional `getBoundingClientRect` calls), so there's no measured jank today. Flagged only because this sprint added the second listener of this exact shape — worth revisiting together if a future pass adds more per-tick work to either one.
- **WCAG/Standard**: n/a
- **Recommendation**: No action needed now. If either handler grows heavier work, batch both through `requestAnimationFrame` at the same time rather than fixing one and not the other.
- **Suggested command**: `/impeccable optimize` (low priority, watch-item only)

---

## Patterns & Systemic Issues

- No systemic issues. Both P2s are isolated to the two surfaces that changed most this sprint (the new accent-color token, the new library scroll listener) rather than indicating a broader gap — the rest of the theming and performance picture (dark mode, other tokens, reader's own already-throttled-by-threshold scroll handler) is clean.

## Positive Findings

- **Two real bugs caught with instrumented evidence, not guesses**: the `.folio-header` `position: sticky`-vs-`absolute` cascade conflict and the library header's scroll-flicker (14 toggles/20s → 2, measured via a `MutationObserver` replay) were both root-caused with actual before/after data before being called fixed — exactly the kind of verification this audit dimension rewards.
- **Deliberate, documented color-family separation**: `cover-gold`, `warm-accent`, and `selected` are three distinct hues with three distinct jobs (book-cover branding, fixed CTA identity, active-selection state) — and DESIGN.md's Named Rules say so explicitly, so future work won't blur them back together.
- **Shape-language change applied uniformly**: `rounded-sm` landed across every control primitive in one pass (`button.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `scroll-area.tsx`) rather than drifting in piecemeal — no leftover `rounded-none` anywhere in the codebase.
- **Zero hardcoded hex colors** in any component file — the token system held through every change this session.
- **Reader's own scroll-direction detector already had a threshold** (`SCROLL_DIRECTION_THRESHOLD_PX`) before this sprint's library flicker bug was found — the fix pattern used for the library scroll listener was proven, not novel.

---

## Recommended Actions

1. **[P2] `/impeccable colorize`**: Retune `--selected`'s light-mode hex to clear 3:1 non-text contrast against `card`/`surface-high` — a single-value fix, verify with a computed contrast ratio before landing.
2. **[P2] `/impeccable optimize`**: Memoize `use-library-screen.ts`'s derived book-list pipeline so the Day 4 scroll listener doesn't force a full re-enrich/sort/filter on every header toggle.
3. **[P3] `/impeccable optimize`**: No action required now — batch both scroll listeners through `requestAnimationFrame` together if either grows heavier per-tick work in the future.
4. **`/impeccable polish`**: Optional final pass once #1–#2 land — nothing else blocking is open.

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `/impeccable audit` after fixes to see your score improve.
