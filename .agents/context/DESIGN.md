---
name: Librune
description: A local-first EPUB reader PWA styled like a bound folio — warm paper tones, serif reading type, and crisp architectural chrome.
colors:
  paper-cream: "#fff9ee"
  ink-black: "#1f1c0f"
  surface-parchment-low: "#fbf3df"
  surface-parchment: "#f5edd9"
  surface-parchment-high: "#f0e8d4"
  surface-parchment-highest: "#eae2ce"
  primary-onyx: "#040505"
  primary-onyx-foreground: "#fff9ee"
  primary-container-charcoal: "#1e1e1e"
  secondary-sand: "#f2e0c8"
  secondary-sand-foreground: "#695d4a"
  muted-taupe-foreground: "#444748"
  destructive-clay: "#b3261e"
  border-mist: "#c4c7c7"
  control-edge: "#7c7e7e"
  ring-umber: "#695d4a"
  divider-parchment: "#eae2ce"
  cover-dark: "#2b241c"
  cover-gold: "#c9a84c"
  warm-accent: "#a67c00"
  warm-accent-foreground: "#1a1200"
  selected: "#835a00"
  selected-foreground: "#fff9ee"
typography:
  display:
    fontFamily: "Cinzel, serif"
    fontSize: "48px"
    letterSpacing: "0.08em"
  headline:
    fontFamily: "Cinzel, serif"
    fontSize: "24px"
    letterSpacing: "0.05em"
  reading:
    fontFamily: "Literata, serif"
    fontSize: "17px"
    lineHeight: 1.6
  reading-lora:
    fontFamily: "Lora, serif"
    fontSize: "17px"
    lineHeight: 1.6
  reading-dm-sans:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "17px"
    lineHeight: 1.6
  reading-atkinson:
    fontFamily: "Atkinson Hyperlegible, sans-serif"
    fontSize: "17px"
    lineHeight: 1.6
  title-sm:
    fontFamily: "Cinzel, serif"
    fontSize: "15px"
    letterSpacing: "0.06em"
  ui:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "14px"
  meta:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "11px"
    letterSpacing: "0.05em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
rounded:
  sm: "0.225rem"
  md: "0.3rem"
  xl: "0.525rem"
  3xl: "0.825rem"
spacing:
  sm: "8px"
  md: "16px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary-onyx}"
    textColor: "{colors.primary-onyx-foreground}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
  button-primary-hover:
    backgroundColor: "{colors.primary-onyx}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.sm}"
  book-card:
    backgroundColor: "{colors.surface-parchment}"
    rounded: "{rounded.xl}"
  sheet-panel:
    backgroundColor: "{colors.surface-parchment}"
    rounded: "{rounded.3xl}"
---

# Design System: Librune

## Overview

**Creative North Star: "The Bound Folio"**

Librune reads like a physical folio: warm cream paper, an ink-black spine of UI chrome, and a gold-on-dark cover accent that echoes traditional bookbinding. The reading surface is set in serif type on soft parchment tones, while the architectural chrome around it — buttons, toolbars, the sticky header — stays quiet and disciplined, so it never competes with the page. Book covers, bottom sheets, and panels are the "paper objects" of the system: they get more generous rounded corners and a consistent gentle lift, as if resting slightly above the surface beneath them. Depth is soft and consistent rather than occasional — every card-like surface carries the same low ambient shadow at rest, not just on hover, reinforcing the sense of physical layered pages.

Corners are soft everywhere, but graduated by role rather than uniform: controls (buttons, menus, dialogs) take a small, disciplined radius that keeps them feeling like precise tools; content objects (book covers, bottom sheets) take a larger radius that reads as a physically rounded paper object. The split is in degree, not in kind — nothing in the system is hard-edged.

**Key Characteristics:**

- Warm parchment palette in light mode, near-black ink in dark mode — never a cold neutral gray.
- Serif display (Cinzel, wide letter-spacing) for titles; serif body (Literata) for reading; sans (Plus Jakarta Sans) for UI chrome only.
- Softly rounded throughout, graduated by role: controls (buttons, menus: `rounded-sm`) read as precise tools; content objects (covers, sheets: `rounded-xl`/`rounded-3xl`) read as rounded paper.
- Consistent soft ambient shadow as a resting-state signature, not just a hover effect.

## Colors

A warm parchment-and-ink palette that inverts cleanly between a cream light mode and a near-black dark mode, plus one amber accent hue reserved exclusively for selection/status signaling — everything else is tone and weight, not new colors.

### Primary

- **Primary Onyx** (`#040505` light / `#f5f2ea` dark): primary buttons, active nav, headline emphasis. Near-black in light mode, near-white in dark mode — a true ink/paper inversion rather than a tinted primary.

### Secondary

- **Secondary Sand** (`#f2e0c8` light / `#3a3220` dark): secondary button fill, selected list items in sheets (TOC drawer, toolbar).

### Accent

- **Warm Accent — Antique Gold** (`#a67c00` bg / `#1a1200` fg, fixed — does not change with theme): reserved for a fixed, theme-independent gold tile, distinct from the primary-onyx ink/paper inversion used everywhere else. Currently unapplied — no surface in the app uses it. The continue-reading banner and the library's speed-dial FAB, its two prior applications, now use the neutral Parchment Low surface (see below) instead, matching the floating chrome elsewhere (dropdown menus, the FAB's own action labels) rather than standing out as gold CTAs.
- **Selected** (`#835a00` bg light / `#e2ad54` bg dark, tuned per theme for contrast): the one color used both to mark "this option is active" — switch checked-track, radio-row selected ring + checkmark, active-filter status dot (WCAG 1.4.11, 3:1) — and as literal text color on the search-result match highlight (`search-result-row.tsx`'s `<mark>`, WCAG 1.4.3, 4.5:1, the stricter case). Darkened 2026-08-23 (light) / lightened slightly (dark) after the highlight case measured only ~3.2:1 against its `bg-cover-gold/35` background — enough for 1.4.11 but not 1.4.3; both themes now clear 4.5:1 there and 5:1+ against `card`/`surface-high`. Distinct from Cover Gold so an amber accent never gets mistaken for "this is a book object."

### Neutral

- **Paper Cream** (`#fff9ee` light / `#141210` dark): app background.
- **Parchment Low/Mid/High/Highest** (`#fbf3df` → `#eae2ce` light; `#1a1713` → `#322b1e` dark): a four-step surface ramp for cards, popovers, and layered panels — each step a shade darker (light mode) or lighter (dark mode) than the background. Parchment Low is also `--popover`, so anything styled `bg-popover` (dropdown menus, the FAB action labels, the continue-reading banner, the library FAB) sits on this same step.
- **Ink Black** (`#1f1c0f` light / `#f2ead8` dark): primary text.
- **Muted Taupe** (`#444748` light / `#b3ada0` dark): secondary/meta text.
- **Border Mist** (`#c4c7c7` light / `#3d3a34` dark): decorative hairlines only — section-card edges, sheet-header rules, cover frames. Deliberately below 3:1; never used on a control.
- **Control Edge** (`#7c7e7e` light / `#757370` dark, `--input`): every interactive boundary — outline-button edges, the switch's off track, radio outlines, the search underline. Held at ≥3:1 against page, card, and surface-high in both themes (WCAG 1.4.11). See the Boundary vs Decoration Rule.

### Named Rules

**Contrast minimums live in `ACCESSIBILITY.md`**, not here — that file is hand-maintained and states the target (WCAG 2.2 AA) plus the one deliberate exception (decorative cover art). Any color decision on this page has to clear it.

**The Boundary vs Decoration Rule.** `--input` is every _control_ boundary — outline-button edges, the switch's off track, radio outlines, the search field's underline — and is held at 3:1 against every surface it sits on. `--border`/`--divider` are _decorative_ container edges and separators (section cards, sheet headers, cover frames) and stay soft on purpose. Never reach for `border-border` on something the user clicks; never darken `--border` to fix a control's legibility.

**The Cover Accent Rule.** `cover-dark` (`#2b241c`) and `cover-gold` (`#c9a84c`) are reserved for book-cover placeholder gradients and never used as UI chrome colors — they signal "this is a book object," not "this is a control."

**The Ink Inversion Rule.** Primary is never a fixed hex — it's always the current theme's ink-on-paper extreme (near-black on cream, near-white on near-black). Never hardcode a mid-tone primary; use the `--primary` token so dark mode inverts correctly.

**The Selection Accent Rule.** `selected` is the only color that means "this is the active choice" — it must not be reused for hover states, emphasis, or decoration, or the signal dilutes. It is intentionally a different hue relationship from `cover-gold` (tuned per theme, not fixed) so the two never get confused despite both being amber-family.

## Typography

**Display Font:** Cinzel (serif, wide tracking) — with system serif fallback
**Body/Reading Font:** Literata (serif) — with system serif fallback
**UI Font:** Plus Jakarta Sans (sans-serif) — with system sans fallback
**Mono Font:** JetBrains Mono

**Character:** Cinzel's engraved, wide-tracked capitals give titles and section headers a bookplate/spine-lettering feel; Literata is a warm, screen-optimized reading serif tuned for long-form text; Plus Jakarta Sans stays deliberately neutral so UI chrome never competes with either serif.

**Reader Fonts (user-selectable, book text only):** Literata (default), **Lora** (serif alternative), **DM Sans** (general-purpose reading sans), **Atkinson Hyperlegible** (accessibility-oriented sans, disambiguates similar characters). Deliberately _not_ Cinzel/Jakarta — those are the app's identity fonts, not reading fonts, and stay reserved for UI chrome/titles per the Serif-For-Content rule below. All four self-hosted under `public/fonts/`, selectable via Settings → Reading or the reader toolbar (`features/preferences`), applied only inside the reader iframe via `--reading-font-family`.

### Hierarchy

- **Display** (Cinzel, 48px / 32px mobile, 0.08em tracking): screen-level titles.
- **Headline** (Cinzel, 24px, 0.05em tracking, `.section-title`): section headers within screens.
- **Reading Large/Medium** (Literata, 20px / 17px, 1.6 line-height): chapter body text inside the reader iframe; max width 68ch (`--reading-max-width`).
- **Title Small** (Cinzel, 15px, 0.06em tracking, `text-title-sm`): compact display titles on small surfaces where the full Headline size (24px) would overwhelm the container — book-cover placeholder titles, and drawer/sheet titles (`SheetTitle`, which carries this treatment by default at 0.18em tracking).
- **UI** (Plus Jakarta Sans, 14px / 12px small): buttons, labels, nav, controls, and the Continue Reading banner's book title — an exception to the pairing below driven by space, not category: at the banner's 48px row height there's no room for Cinzel's wider tracking without truncating harder than the sans already does.
- **Meta** (Plus Jakarta Sans, 11px, 0.05em tracking, uppercase, `.metadata`, `text-meta`): timestamps, byline-style metadata, badges, cover-placeholder author labels.

### Named Rules

**The Ramp-Only Rule.** Every font size comes from the `--text-*` scale (`text-display-lg` … `text-meta`) — never Tailwind's built-in `text-sm`/`text-base`/`text-xs`, even in shadcn-generated primitives, and never a literal px value. `cn()` is configured (`src/utils/cn.ts`) so tailwind-merge classifies these as font sizes; without that, a `cn("text-title-sm", …, "text-foreground")` silently drops the size.

**The Serif-For-Content Rule.** Any text the reader is meant to actually _read_ (titles, chapter text) uses a serif; any text that helps them _operate_ the app (buttons, nav, meta labels) uses the sans. Don't cross the two.

## Layout

The library screen uses a fluid auto-fill grid for book covers (`grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))`, `gap-x-4 gap-y-7`) rather than fixed breakpoint columns — density adapts continuously to viewport width instead of jumping between named breakpoints. The reading column inside the iframe is capped at `--reading-max-width: 68ch` and horizontally centered, independent of the outer viewport. The header is sticky (`position: sticky; top: 0`) with an 80px height and a translucent blurred backdrop (`backdrop-filter: blur(12px)`, `background: rgb(255 249 238 / 85%)` in light mode) so content scrolls beneath it without a hard seam.

## Elevation & Depth

Librune leans on soft ambient shadow as a constant resting-state signature rather than a hover-only effect — the "lifted paper" reading. `--shadow-soft` (`0 2px 8px rgba(31,28,15,0.04)` light / heavier alpha in dark) sits under book covers and similar content surfaces at rest via the `.elevated-soft` utility, and deepens slightly on hover (`group-hover:shadow-lg`). Bottom sheets (TOC drawer, reader toolbar) forgo shadow in favor of a hard top border plus rounded top corners — they read as physically sliding up from beneath the screen edge, not floating above it. A separate `--shadow-floating` token (`0 8px 40px rgba(0,0,0,0.5)`) is reserved for genuinely overlaid elements.

### Shadow Vocabulary

- **Soft** (`box-shadow: var(--shadow-soft)`): resting elevation for book covers and card-like content surfaces; class `.elevated-soft`.
- **Floating** (`box-shadow: var(--shadow-floating)`): heavier lift for elements that overlay other content directly; class `.shadow-floating`.

### Named Rules

**The Resting Lift Rule.** Content objects (book covers) carry `.elevated-soft` at rest, not only on hover — depth communicates "this is a physical object," not "this is interactive."

## Shapes

One corner language, graduated by role. **Controls take the small end of the scale**: buttons, dropdown/context menus, and dialogs use `rounded-sm` (0.225rem) — a disciplined, tool-like rounding, never sharp but never as generous as a content object. **Content objects take the large end**: book covers use `rounded-xl` (0.525rem), bottom sheets use `rounded-t-3xl` (0.825rem) on their top edge only. Borders are hairline (`border`, `0.5px` on the sticky header) in `border-mist`/`divider-parchment`, never heavy.

### Named Rules

**The Object/Control Split.** If it's something the user reads or holds (a book cover, a sheet, a popover), round it generously. If it's something the user presses (a button, a menu, a dialog), round it modestly. Both are always softly rounded — the split is in degree, not sharp-vs-round.

## Components

### Buttons

- **Shape:** `rounded-sm` (0.225rem), regardless of size variant — modest, not sharp.
- **Primary:** `bg-primary` / `text-primary-foreground`, hover `bg-primary/80`; heights range `h-6` (xs) to `h-9` (lg), horizontal padding ~10px.
- **Secondary:** `bg-secondary` / `text-secondary-foreground`, hover mixes 5% foreground into the secondary color via `color-mix(in oklch, ...)`.
- **Outline / Ghost / Destructive / Link:** outline uses `border-border` with a transparent fill; ghost is borderless with a muted hover fill; destructive uses a low-opacity destructive tint (`bg-destructive/10`) rather than a solid fill; link is text-only with underline-on-hover.
- **Active/press state:** buttons nudge down 1px on press (`active:translate-y-px`) — a tactile "pressed into the page" cue.
- **Focus:** 1px ring in `ring` color plus a matching border color shift, not a glow.

### Cards / Book Covers

- **Corner Style:** `rounded-xl` (0.525rem), applied to the cover image wrapper.
- **Background:** cover image, or a per-book gradient placeholder (`palette.gradient`) when no cover art exists.
- **Shadow Strategy:** `.elevated-soft` at rest, deepening to `shadow-lg` on hover.
- **Border:** hairline `border-border/40`.
- **Badges:** "NEW" badge is a filled corner tab (`rounded-bl-xl`, translucent background) rather than a floating chip.

### Sheets / Drawers (TOC, reader toolbar)

- **Style:** slide up from the bottom edge, `rounded-t-3xl` top corners only, `bg-card`, no shadow — a hard `border-t` substitutes for elevation since they're anchored to the viewport edge.
- **Header:** `border-b`, with a centered pill drag-handle (`h-1 w-16 rounded-full bg-border`) signaling draggability.
- **List items:** rendered as `Button` variants (`secondary` when active, `ghost` otherwise) rather than a bespoke list-item component — inherits the square-cornered control language even inside a rounded sheet.

### Navigation / Header

- **Style:** sticky, translucent, blurred (`backdrop-filter: blur(12px)`), divider-bordered top and bottom (`0.5px` hairlines).
- **Controls:** icon-only ghost buttons (`Button variant="ghost" size="icon"`); no visible text labels in the primary nav.

## Do's and Don'ts

### Do:

- **Do** keep controls at the modest end of the radius scale (`rounded-sm`) — never sharp, never as generous as a content object's radius.
- **Do** give content objects (covers, sheets) a rounded, soft-lifted treatment (`.elevated-soft` + `rounded-xl`/`rounded-3xl`).
- **Do** pair serif type (Cinzel/Literata) with anything the user reads, and sans (Plus Jakarta Sans) with anything the user operates.
- **Do** use the `--primary` token (never a hardcoded hex) for anything meant to invert correctly between light and dark mode.
- **Do** reserve `cover-dark`/`cover-gold` strictly for book-cover-related surfaces.
- **Do** use `selected` only to mark active/checked state (switches, radio rows, active-filter indicator) — never as a hover tint or decoration.

### Don't:

- **Don't** round a button or chip to match a content object's larger radius — it breaks the control/content split.
- **Don't** add a drop shadow to bottom sheets; their elevation cue is the top border + rounded-top-corners + slide animation, not shadow.
- **Don't** introduce a cold neutral gray; all neutrals in this system are warm parchment/ink tones.
- **Don't** use the sans UI font for reading-surface body text, or the serif reading font for buttons/nav labels.
- **Don't** use `warm-accent` or `selected` interchangeably with `cover-gold` — they're deliberately distinct hues so "book object," "CTA tile," and "active selection" stay three separate signals.
