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
  ring-umber: "#695d4a"
  divider-parchment: "#eae2ce"
  cover-dark: "#2b241c"
  cover-gold: "#c9a84c"
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
  none: "0px"
  md: "0.3rem"
  xl: "0.525rem"
  3xl: "1.05rem"
spacing:
  sm: "8px"
  md: "16px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary-onyx}"
    textColor: "{colors.primary-onyx-foreground}"
    rounded: "{rounded.none}"
    padding: "0 10px"
  button-primary-hover:
    backgroundColor: "{colors.primary-onyx}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.none}"
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

Librune reads like a physical folio: warm cream paper, an ink-black spine of UI chrome, and a gold-on-dark cover accent that echoes traditional bookbinding. The reading surface is set in serif type on soft parchment tones, while the architectural chrome around it — buttons, toolbars, the sticky header — stays crisp, sharp-cornered, and quiet, so it never competes with the page. Book covers, bottom sheets, and panels are the "paper objects" of the system: they get soft rounded corners and a consistent gentle lift, as if resting slightly above the surface beneath them. Depth is soft and consistent rather than occasional — every card-like surface carries the same low ambient shadow at rest, not just on hover, reinforcing the sense of physical layered pages.

The system rejects flat, hard-edged material-design card language for controls (no rounded buttons) while embracing it for content objects (rounded covers and sheets) — the split is deliberate: controls are tools, content is the book.

**Key Characteristics:**

- Warm parchment palette in light mode, near-black ink in dark mode — never a cold neutral gray.
- Serif display (Cinzel, wide letter-spacing) for titles; serif body (Literata) for reading; sans (Plus Jakarta Sans) for UI chrome only.
- Sharp rectangular controls (buttons: `rounded-none`) against soft rounded content objects (covers, sheets: `rounded-xl`/`rounded-3xl`).
- Consistent soft ambient shadow as a resting-state signature, not just a hover effect.

## Colors

A single warm parchment-and-ink palette that inverts cleanly between a cream light mode and a near-black dark mode; there is no secondary or tertiary hue family — accent duty is carried by tone and weight, not new colors.

### Primary

- **Primary Onyx** (`#040505` light / `#f5f2ea` dark): primary buttons, active nav, headline emphasis. Near-black in light mode, near-white in dark mode — a true ink/paper inversion rather than a tinted primary.

### Secondary

- **Secondary Sand** (`#f2e0c8` light / `#3a3220` dark): secondary button fill, selected list items in sheets (TOC drawer, toolbar).

### Neutral

- **Paper Cream** (`#fff9ee` light / `#141210` dark): app background.
- **Parchment Low/Mid/High/Highest** (`#fbf3df` → `#eae2ce` light; `#1a1713` → `#322b1e` dark): a four-step surface ramp for cards, popovers, and layered panels — each step a shade darker (light mode) or lighter (dark mode) than the background.
- **Ink Black** (`#1f1c0f` light / `#f2ead8` dark): primary text.
- **Muted Taupe** (`#444748` light / `#b3ada0` dark): secondary/meta text.
- **Border Mist** (`#c4c7c7` light / `#3d3a34` dark): hairline borders, dividers, inputs.

### Named Rules

**The Cover Accent Rule.** `cover-dark` (`#2b241c`) and `cover-gold` (`#c9a84c`) are reserved for book-cover placeholder gradients and never used as UI chrome colors — they signal "this is a book object," not "this is a control."

**The Ink Inversion Rule.** Primary is never a fixed hex — it's always the current theme's ink-on-paper extreme (near-black on cream, near-white on near-black). Never hardcode a mid-tone primary; use the `--primary` token so dark mode inverts correctly.

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
- **Title Small** (Cinzel, 15px, 0.06em tracking, `text-title-sm`): compact display titles on small surfaces where the full Headline size (24px) would overwhelm the container — book-cover placeholder titles, the Continue Reading banner's book title.
- **UI** (Plus Jakarta Sans, 14px / 12px small): buttons, labels, nav, controls.
- **Meta** (Plus Jakarta Sans, 11px, 0.05em tracking, uppercase, `.metadata`, `text-meta`): timestamps, byline-style metadata, badges, cover-placeholder author labels.

### Named Rules

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

Two coexisting corner languages by role. **Controls are sharp**: all button variants use `rounded-none` — a deliberate rejection of the soft-rounded button default, giving the UI chrome a drafting-table, architectural precision. **Content objects are soft**: book covers use `rounded-xl` (0.525rem), bottom sheets use `rounded-t-3xl` (1.05rem) on their top edge only, and popovers/dropdowns inherit the base `--radius` (0.375rem) scale. Borders are hairline (`border`, `0.5px` on the sticky header) in `border-mist`/`divider-parchment`, never heavy.

### Named Rules

**The Object/Control Split.** If it's something the user reads or holds (a book cover, a sheet, a popover), round it. If it's something the user presses (a button, a chip-like control), keep it square. Never round a button to match a card's radius.

## Components

### Buttons

- **Shape:** square corners (`rounded-none`, 0px), regardless of size variant.
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

- **Do** keep all button/control corners square (`rounded-none`) — never introduce a rounded button variant.
- **Do** give content objects (covers, sheets, popovers) a rounded, soft-lifted treatment (`.elevated-soft` + `rounded-xl`/`rounded-3xl`).
- **Do** pair serif type (Cinzel/Literata) with anything the user reads, and sans (Plus Jakarta Sans) with anything the user operates.
- **Do** use the `--primary` token (never a hardcoded hex) for anything meant to invert correctly between light and dark mode.
- **Do** reserve `cover-dark`/`cover-gold` strictly for book-cover-related surfaces.

### Don't:

- **Don't** round a button or chip to match card radius — it breaks the control/content split.
- **Don't** add a drop shadow to bottom sheets; their elevation cue is the top border + rounded-top-corners + slide animation, not shadow.
- **Don't** introduce a cold neutral gray; all neutrals in this system are warm parchment/ink tones.
- **Don't** use the sans UI font for reading-surface body text, or the serif reading font for buttons/nav labels.
