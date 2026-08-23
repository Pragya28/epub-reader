# Impeccable Audit Report — Librune

Generated 2026-08-23 (re-run after Sprint 7 Day 4 — Library Navigation, "Next in series" affordance). Codebase-wide technical audit (`/impeccable audit`), not a design critique. Scope: `src/` (all `.tsx`/`.ts` app/feature/UI/service files). Detector run: `detect.mjs --json src` → 13 findings, all verified false positives (see Implementation Integrity Verdict).

**Status: all findings from this run resolved same-day** (P1 via `/impeccable layout`, both P2s via `/impeccable colorize` and `/impeccable harden`, P3 corrected via `/impeccable optimize` — see below). Scores reflect the fixed state. Re-verified via a second `/impeccable audit` pass after a `/impeccable polish` sweep found no additional defects: detector output unchanged (same 13 false positives), `tsc -b`/`eslint`/`detect.mjs --scope layout` all clean.

---

## Audit Health Score

| #         | Dimension                | Score     | Key Finding                                                                                                                                                |
| --------- | ------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Accessibility            | 4         | `--selected` retuned to clear WCAG 1.4.3 (4.5:1) for the search-match highlight text case; search-screen icon buttons now meet the 24px minimum            |
| 2         | Performance              | 4         | `use-library-screen.ts`'s derivation pipeline is memoized; the reader's scroll listener was already rAF-throttled (a prior audit's finding here was stale) |
| 3         | Responsive Design        | 4         | The reader's "Next book" banner no longer overlaps the reader's own fixed footer — moved in-flow inside it instead of floating independently               |
| 4         | Theming                  | 4         | Full token system maintained; `--selected`'s fix stayed within the existing token, no new colors introduced                                                |
| 5         | Implementation Integrity | 4         | Detector's 13 findings are all false positives (test fixtures, or reader fonts already documented in DESIGN.md's prose)                                    |
| **Total** |                          | **20/20** | **Excellent**                                                                                                                                              |

**Previous score: 17/20 (this session, pre-fix) / 18/20 (2026-08-13).** All four findings from the pre-fix pass are resolved: the new P1 (footer/banner overlap), both carried-over P2s (contrast, touch targets), and the P3 was corrected rather than fixed — it turned out to already be resolved on the reader side, and not worth fixing on the cheap library-side handler (see below).

---

## Implementation Integrity Verdict

**Pass.** All 13 mechanical detector findings are false positives on inspection:

- 6× "font outside DESIGN.md" (`reader-iframe-styles.ts`: Lora, DM Sans, Atkinson Hyperlegible) — these are the app's documented reader-selectable fonts, listed by name in DESIGN.md's "Reader Fonts (user-selectable, book text only)" section. The detector only diffs against the `typography` frontmatter block, not that prose — a detector gap, not a code issue.
- 4× "broken image" — all inside test fixtures (`epub-parser.test.ts`, `chapter-parser.test.ts`) exercising malformed-HTML parsing paths, not shipped UI.
- 3× "font size outside ramp" — same test files, asserting against literal `18px` fixture markup, not real UI.

Sprint 7 Day 4's new code (`getNextInSeries()` in `groupings.ts`, the `ContinueReadingBanner`'s `label`/`variant` props, `pickCurrentlyReadingBook`'s broadened filter) reuses existing primitives and tokens rather than inventing new ones — no drift from `.agents/context/DESIGN.md`.

---

## Executive Summary

- Audit Health Score: **20/20** (Excellent), up from 17/20 pre-fix
- All findings from this run resolved: 0 P0, 0 P1, 0 P2, 0 P3 remaining
- What was fixed:
  1. **[P1 → fixed] Reader "Next book" banner overlap** — `ContinueReadingBanner` gained a `variant="inline"` mode; the reader now renders it as a third row inside its own footer instead of a second competing `fixed` overlay.
  2. **[P2 → fixed] `--selected` contrast** — retuned in both themes; also caught that the real gap was WCAG 1.4.3 (4.5:1, text) not 1.4.11 (3:1, non-text) — the mark highlight renders `--selected` as literal text, not a state indicator. Added a regression test (`token-contrast.test.ts`) covering the composited-background case that let this slip through before.
  3. **[P2 → fixed] Search-screen icon buttons** — swapped for `Button variant="ghost" size="icon"`/`"icon-sm"`, matching the app's existing pattern.
  4. **[P3 → corrected] "Unthrottled scroll listeners"** — the reader's listener was already rAF-throttled; this finding had gone stale across audits without re-verification. The library's listener remains untouched (deliberately) since its handler is trivially cheap — throttling it would be complexity with no measurable benefit.
- Recommended next steps: none blocking. Re-run `/impeccable audit` periodically to catch drift; consider a `/impeccable polish` pass if further refinement is wanted.

---

## Resolved Findings

**[P1 → Fixed] Reader "Next book" banner overlap with the reader's fixed footer**

- Was: `ContinueReadingBanner` rendered as a `fixed bottom-5 z-40` overlay in `reader-screen.tsx`, competing with the reader's own `fixed`/`absolute bottom-0 z-20` footer for the same screen real estate.
- Fix: added `variant?: "floating" | "inline"` to `ContinueReadingBanner` (`continue-reading-banner.tsx`). The reader now renders it `variant="inline"` as a third row inside the footer's own flex column (`reader-screen.tsx:178-190`) — in-flow, never overlapping, and it now shows/hides together with the rest of the reader chrome instead of floating independently of it. The library screen's usage is untouched (still defaults to `"floating"`).
- Verified: `tsc -b`, `eslint`, and `detect.mjs --scope layout` all clean; dev server loads with no new console errors.

**[P2 → Fixed] `--selected` contrast**

- Was: `--selected: oklch(58.07% 0.1046 78.37)` (light) — a 2026-08-07 fix that cleared WCAG 1.4.11 (3:1, non-text) against `card`/`surface-high`, but the search-result `<mark>` highlight (`search-result-row.tsx:30`) renders `--selected` as literal _text_ on a semi-transparent `bg-cover-gold/35` background — the stricter WCAG 1.4.3 (4.5:1) applies there, and it only measured ~3.2:1.
- Fix: darkened light-mode `--selected` to `oklch(50% 0.1046 78.37)` (`#835a00`, 4.51:1 against the mark's composited background, 5.2:1+ against card/surface-high) and lightened dark-mode to `oklch(78% 0.123 78.89)` (`#e2ad54`, 4.53:1 against its equivalent). `.agents/context/DESIGN.md` updated with the corrected hex and rationale.
- Added `src/__tests__/token-contrast.test.ts` case computing the actual composited (semi-transparent) background rather than a plain token pair — the gap in the existing harness that let a 1.4.11-only check hide a 1.4.3 failure.
- Verified: full `token-contrast.test.ts` suite passes (46 assertions across both themes); full `src/features`/`src/services`/`src/__tests__` suite (571 tests) passes with no regressions from the token change.

**[P2 → Fixed] Undersized icon-only buttons on search screen**

- Was: bare `<button>` elements for back (`ArrowLeft`) and clear (`X`) in `search-screen.tsx`, hit area equal to the icon glyph (~14-20px), below WCAG 2.2 AA's 24×24px minimum.
- Fix: swapped both for the existing `Button` component — `variant="ghost" size="icon"` (32px) for back, `size="icon-sm"` (28px) for the inline clear button — matching the pattern already used in `GroupingDetailScreen` and elsewhere. Icon glyphs and `aria-label`s unchanged.
- Verified: `tsc -b`, `eslint`, `detect.mjs` all clean; visually confirmed in the browser preview — both buttons render with a larger tap area and no layout shift in the search pill; no new console errors.

**[P3 → Corrected, not a real finding] "Two unthrottled scroll listeners"**

- `use-reader-engine.ts`'s scroll listener (`:456-466`) was already rAF-throttled (a `ticking` flag coalesces native scroll events into one `handleScroll()` per animation frame) — this finding was stale, carried forward across multiple audits without re-checking the code, the same class of error as the `--selected` finding above (verify-before-reporting gap, not a code gap).
- `use-library-screen.ts`'s listener genuinely has no throttle, but its handler (`handleChromeScroll` → `use-chrome-visibility.ts`) does only a couple of number comparisons with an early-return guard — no DOM reads, no layout queries, no measurable per-tick cost. Left as-is per "don't optimize what isn't slow"; the original recommendation was itself conditional ("rAF-batch if a third listener of this shape is added"), and no third listener exists.

---

## Patterns & Systemic Issues

- Two of this run's findings (`--selected` contrast, scroll-listener throttling) were **stale carried-over claims** rather than current code state — both prior audits reported a historical measurement or an already-fixed detail without re-verifying against the code at hand. Worth treating each future audit's carried-over findings as claims to re-check, not facts to restate.
- The new P1 was isolated to the reader screen's brand-new banner placement; it never affected the library screen's identical-looking banner, which has no competing fixed footer to collide with.

## Positive Findings

- `use-library-screen.ts`'s enrich→sort→filter→search pipeline is properly `useMemo`'d.
- Sprint 7 Day 4's new banner variants (`label`, `variant` props on `ContinueReadingBanner`) are minimal, backward-compatible extensions — the default (no props) rendering is unchanged, and no new component was built where extending the existing one sufficed.
- `getNextInSeries()`, the broadened `pickCurrentlyReadingBook()` filter, and the `--selected` contrast fix are all covered by new/updated tests rather than shipped untested.
- No hardcoded colors found anywhere in this sprint's new files — full token reuse throughout.

---

Re-run `/impeccable audit` after further changes to keep this current.
