# ACCESSIBILITY.md

Librune's accessibility contract. Hand-maintained — unlike `DESIGN.md`, this file is **not** derived from the shipped artifact, and `/impeccable document` must not regenerate it. Lines here are targets: some describe what the app already does, some describe what it must do before Sprint 8's validation pass. Each is marked.

Written 2026-08-07 as the prerequisite for Sprint 5 `#27`, resolving the open questions in `docs/07 - Gaps/Accessibility-01 Accessibility Scope.md`.

## Target

**WCAG 2.2 Level AA**, for the app shell and the reader alike.

2.2 rather than 2.1 because its additions (2.4.11 Focus Not Obscured, 2.5.8 Target Size) are exactly this app's risk areas: chrome that slides over content on scroll, and a touch-first control set. AA rather than AAA because AAA's 7:1 contrast requirement is incompatible with the warm, low-contrast paper palette that is the product's whole visual premise — see `DESIGN.md`.

Where a criterion cannot be met without abandoning a deliberate product decision, the exception is recorded below rather than silently failed.

## Standing rules

These are enforceable now; `#27` and any future audit validate against them.

**Contrast (1.4.3, 1.4.11).** Body and UI text ≥ 4.5:1 against its background. Large text (≥ 24px, or ≥ 19px bold) and non-text UI boundaries — control borders, focus rings, the selected state of a filter chip or radio row, progress-bar fill — ≥ 3:1. Both light and dark themes, independently. This is the rule the `--selected` fix (`75d5244`, 2.65:1 → 3.5:1) was already applying; it is now written down.

**Exception — decorative cover art.** Generated book-cover placeholder titles and ornaments (`--cover-gold`, the palette gradients) are decorative representations of a book object, not UI text, and are exempt from 1.4.3. The book's real title always appears as compliant text beneath the cover.

**Focus (2.4.7, 2.4.11, 2.4.13).** Every interactive control shows a visible focus ring — `focus-visible:ring` on the shared primitives, never `outline-none` without a replacement. A focused control must not be covered by the reader's sliding header/footer: any programmatic focus move has to reveal the chrome first. _(The primitives comply; the chrome-occlusion rule is a target — nothing enforces it today.)_

**Motion (2.3.3).** `prefers-reduced-motion: reduce` collapses transitions and animations to 1ms globally (`index.css`), keeping final state and color feedback intact. No separate user-facing motion toggle — the OS setting is the single source. _(Shipped.)_

**Target size (2.5.8).** Interactive targets ≥ 24×24 CSS px, including the icon-only chrome buttons and stepper +/− controls. Where the visual control is smaller, the hit area is extended (the `after:-inset-*` pattern already used in `switch.tsx` and `radio-group.tsx`). _(Partially shipped — not audited.)_

**Theme and typography are accessibility features, not just preferences.** Font scale, line height, margins, and paragraph spacing already give users the reflow and spacing control that 1.4.4 and 1.4.12 ask for; the theme system covers 1.4.3 in both directions. No bespoke "high contrast mode" — meeting AA in both themes is the commitment instead.

## The reader is the hard part

The reader is not a document. It is a same-origin `srcdoc` iframe holding a hand-built windowing engine that keeps at most 5 chapters mounted (`MAX_WINDOW_SIZE`), mounting and unmounting `<section>` elements as the user scrolls. Standard ARIA patterns do not cleanly apply, and this is the highest-risk surface in the project — the gap doc's central point, and it stands.

Known consequences, all currently unresolved:

- **The book is not fully in the accessibility tree.** A screen reader can only reach the mounted window, so "read the whole book" and "find text later in the book" don't work the way they would on a normal page. This is inherent to virtualization, not a bug to be patched — the resolution is either a documented linear-reading affordance or an accepted, stated limitation. **Open — decide before Sprint 8.**
- **Chapters appearing and disappearing during scroll are unannounced.** Content mutating under a screen reader with no live-region signal is disorienting. A polite live region announcing chapter transitions is the likely fix. **Target.**
- **The iframe document declares no language** (3.1.1). `initializeReaderDocument` writes `<html>` with no `lang`, though `ParsedBook.language` is parsed and available. This is a concrete, cheap failure to fix. **Target — fix in `#27` or `#29`.**
- **Chrome visibility is tap- and scroll-driven** (`use-chrome-visibility.ts`), with no keyboard or screen-reader path to reveal the header and footer. Keyboard users can reach the controls only while the chrome happens to be visible. **Target.**
- **The iframe is `tabIndex={0}` and titled "reader"** — a generic label. It should carry the book title. **Target — trivial.**

## Testing approach

Continuously, not as a Sprint 8 bolt-on — retrofitting the interaction patterns above is the expensive path the gap doc warned about.

- **Every design pass:** the Impeccable mechanical detector and `/impeccable audit` catch contrast and focus regressions; that is what found the `--selected` failure.
- **Per surface, once:** keyboard-only walkthrough (tab order, focus visibility, escape/dismiss) and one screen-reader pass (VoiceOver on macOS/iOS — the PWA's primary target).
- **Sprint 8:** validation and polish against this document, not first-pass implementation.

## Relationship to other docs

- `DESIGN.md` — visual system. Its contrast-affecting Named Rules defer to this file for minimums; it does not restate them.
- `docs/07 - Gaps/Accessibility-01` — the deliberation this file resolves. Kept in the notes vault, not in the repo.
