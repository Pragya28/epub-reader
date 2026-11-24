---
name: Librune
description: A local-first EPUB reader PWA styled like a bound folio — warm paper tones, serif reading type, crisp tool-like chrome, and a carved-books mark.
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
  secondary-sand: "#e8d2b6"
  secondary-sand-foreground: "#574b39"
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
  display-lg:
    fontFamily: "Cinzel, serif"
    fontSize: "48px"
    lineHeight: 1.1
    letterSpacing: "0.08em"
  display-lg-mobile:
    fontFamily: "Cinzel, serif"
    fontSize: "32px"
    lineHeight: 1.15
    letterSpacing: "0.08em"
  headline:
    fontFamily: "Cinzel, serif"
    fontSize: "24px"
    lineHeight: 1.2
    letterSpacing: "0.05em"
  title-sm:
    fontFamily: "Cinzel, serif"
    fontSize: "15px"
    lineHeight: 1.3
    letterSpacing: "0.06em"
  reading-lg:
    fontFamily: "Literata, serif"
    fontSize: "20px"
    lineHeight: 1.6
  reading-md:
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
  ui:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "14px"
    lineHeight: 1.4
  ui-sm:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
  meta:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "11px"
    lineHeight: 1.4
    letterSpacing: "0.05em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "13px"
    lineHeight: 1.5
rounded:
  base: "0.375rem"
  sm: "0.225rem"
  md: "0.3rem"
  lg: "0.375rem"
  xl: "0.525rem"
  2xl: "0.675rem"
  3xl: "0.825rem"
  4xl: "0.975rem"
spacing:
  sm: "8px"
  md: "16px"
  lg: "20px"
  grid-y: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary-onyx}"
    textColor: "{colors.primary-onyx-foreground}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "32px"
  button-secondary:
    backgroundColor: "{colors.secondary-sand}"
    textColor: "{colors.secondary-sand-foreground}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.paper-cream}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.sm}"
    height: "32px"
  search-field:
    backgroundColor: "{colors.surface-parchment}"
    textColor: "{colors.muted-taupe-foreground}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
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

Librune reads like a physical folio: warm cream paper, an ink-black spine of UI chrome, and a gold-on-dark cover accent that echoes traditional bookbinding. The reading surface is set in serif type on soft parchment tones, while the architectural chrome around it — buttons, toolbars, the sticky header — stays quiet and disciplined, so it never competes with the page. The system is warm and papery, and scholarly in its type: engraved Cinzel capitals for titles, a screen-tuned serif for reading, and a neutral sans only for operating the app.

Depth comes from tonal layering, not decoration. Four parchment steps stack like pages; hairline rules (0.5px on the header) separate them; and only content objects — book covers — carry a soft resting shadow. Controls are tool-like and modestly rounded; content objects (covers, sheets) are rounded more generously, so they read as physical paper. The identity mark follows the same logic: three carved books standing behind an open book, drawn from straight strokes so they read like carved runes without being real runes.

**Key Characteristics:**

- Warm parchment palette in light mode, near-black ink in dark mode — never a cold neutral gray.
- Serif display (Cinzel, wide tracking) for titles; serif (Literata) for reading; sans (Plus Jakarta Sans) for UI chrome only.
- Radius graduated by role: controls `rounded-sm`, search field `rounded-md`, covers `rounded-xl`, sheets `rounded-t-3xl`.
- Soft ambient shadow only on content objects at rest; a hard top border, not shadow, on bottom sheets.
- Gold is a book-object colour: it appears on the mark, the app tile, covers and the I and U of the dark wordmark, never on UI chrome.

## Colors

A warm parchment-and-ink palette that inverts cleanly between a cream light mode and a near-black dark mode, plus one amber accent (`selected`) reserved for active-choice signaling and one gold (`cover-gold`) reserved for book objects. Everything else is tone and weight.

### Primary

- **Primary Onyx** (`#040505` light / `#f5f2ea` dark): primary buttons, active nav, headline emphasis. A true ink/paper inversion, not a tinted primary. Its container tone (`primary-container`) is `#1e1e1e` light / `#2c2a24` dark.

### Secondary

- **Secondary Sand** (`#e8d2b6` light / `#3a3220` dark; foreground `#574b39` / `#cbb98e`): secondary button fill, selected list items in sheets, the tab strip and the header's translucent base. Also serves as `accent`.

### Accent

- **Selected** (`#835a00` light / `#e2ad54` dark, tuned per theme): the one color for "this option is active" — switch checked track, radio-row ring and check, active-filter dot — and for the search-result match text. Clears 4.5:1 on its highlight and 5:1+ against `card` and `surface-high`. Distinct from Cover Gold so an amber accent is never mistaken for a book object.
- **Cover Gold** (`#c9a84c`, fixed): book objects only — cover placeholder gradients, the mark, the app tile, and the I and U of the dark wordmark. Gold on parchment is 2.2:1, so it never appears on a light ground.
- **Warm Accent** (`#a67c00` bg / `#1a1200` fg, fixed): a theme-independent gold tile defined in the tokens and currently unused by any surface.
- **Logo Accent** (`--logo-accent`): the book letters I and U of the wordmark. Resolves to `selected` brown on light and `cover-gold` on dark.

### Neutral

- **Paper Cream** (`#fff9ee` light / `#141210` dark): app background.
- **Parchment Low / Mid / High / Highest** (`#fbf3df`, `#f5edd9`, `#f0e8d4`, `#eae2ce` light; `#1a1713`, `#211d16`, `#292319`, `#322b1e` dark): a four-step surface ramp for popovers, cards, muted fills and the highest panels. Low is also `popover` and `sidebar`.
- **Ink Black** (`#1f1c0f` light / `#f2ead8` dark): primary text.
- **Muted Taupe** (`#444748` light / `#b3ada0` dark): secondary and meta text.
- **Destructive Clay** (`#b3261e` light / `#f2b8b5` dark): destructive actions; buttons use it as a low-opacity tint, not a solid fill.
- **Border Mist** (`#c4c7c7` light / `#3d3a34` dark): decorative hairlines only — section cards, sheet-header rules, cover frames. Deliberately below 3:1.
- **Control Edge** (`#7c7e7e` light / `#757370` dark, `--input`): every interactive boundary, held at 3:1 or better against page, card and surface-high.
- **Divider Parchment** (`#eae2ce` light / `#2c2820` dark): header rules and sheet separators.

### Cover Palettes

Book placeholders use one of 30 palettes (`src/constants/cover-palettes.ts`), each a 150° gradient from `from` to `to` with a title in `accent` and an author line in `sub`. The author line carries a per-palette alpha so each palette keeps readable contrast on its own gradient. Choose one per book and keep it stable; do not reorder the palette list, since that reassigns every book's colour.

### Named Rules

**Contrast minimums live in `ACCESSIBILITY.md`**, not here. That file is hand-maintained, targets WCAG 2.2 AA and records the one deliberate exception (decorative cover art). Any color decision here must clear it.

**The Boundary vs Decoration Rule.** `--input` is every control boundary — outline-button edges, the switch's off track, radio outlines, the search field's underline — and is held at 3:1 against every surface it sits on. `--border` and `--divider` are decorative container edges and stay soft. Never put `border-border` on something the user clicks, and never darken `--border` to fix a control's legibility.

**The Cover Accent Rule.** `cover-dark` and `cover-gold` are reserved for book-cover placeholders, the mark and the app tile. They signal "this is a book object," not "this is a control."

**The Ink Inversion Rule.** Primary is never a fixed hex. It is always the current theme's ink-on-paper extreme. Use the `--primary` token.

**The Selection Accent Rule.** `selected` is the only color that means "this is the active choice." Never reuse it for hover, emphasis or decoration.

**The No Gold On Parchment Rule.** Gold letters and the gold mark never sit on a light ground; on parchment, use ink for the mark and the wordmark.

## Typography

**Display Font:** Cinzel (serif, wide tracking)
**Reading Font:** Literata (serif); user-selectable alternatives Lora, DM Sans and Atkinson Hyperlegible
**UI Font:** Plus Jakarta Sans (sans-serif)
**Mono Font:** JetBrains Mono, for code and data only

**Character:** Cinzel's engraved, wide-tracked capitals give titles and section headers a bookplate, spine-lettering feel. Literata is a warm, screen-optimized reading serif. Plus Jakarta Sans stays deliberately neutral so UI chrome never competes with either serif. Reader fonts apply only inside the reader iframe, through `--reading-font-family`, and are never used for app chrome.

### Hierarchy

- **Display** (Cinzel 400, 48px / 32px mobile, line-height 1.1, 0.08em tracking): screen-level titles.
- **Headline** (Cinzel 400, 24px, 1.2, 0.05em, `.section-title`): section headers within screens.
- **Title Small** (Cinzel 400, 15px, 1.3, 0.06em): book-cover placeholder titles; sheet and drawer titles (`SheetTitle` uses 0.18em tracking, uppercase).
- **Reading Large / Medium** (Literata 400, 20px / 17px, 1.6): chapter text inside the reader iframe, capped at 68ch.
- **UI** (Plus Jakarta Sans, 14px; 12px at weight 500 for compact controls): buttons, labels, nav, list items.
- **Meta** (Plus Jakarta Sans, 11px, 0.05em tracking, uppercase): timestamps, badges, cover author labels.

### Named Rules

**The Ramp-Only Rule.** Every font size comes from the `--text-*` scale (`text-display-lg` … `text-meta`) — never Tailwind's built-in `text-sm`/`text-base`/`text-xs`, and never a literal px value. `cn()` is configured so tailwind-merge classifies these as font sizes.

**The Serif-For-Content Rule.** Text the reader reads (titles, chapter text) is serif; text that operates the app (buttons, nav, meta) is sans.

**The Wordmark Is Not Type Rule.** "Librune" is set only with the wordmark files, never in Cinzel or any font.

## Layout

The library uses a fluid auto-fill grid for covers (`repeat(auto-fill, minmax(160px, 1fr))`, `gap-x-4 gap-y-7`) rather than fixed breakpoint columns, so density adapts continuously. Library, shelves and search sit behind pill tabs (Books / Shelves) on a `tab-strip` fill. The reading column in the iframe is capped at `--reading-max-width: 68ch` and centered. The header is sticky, 80px tall, with a translucent blurred backdrop (`backdrop-filter: blur(12px)`) over `header-bg` — secondary sand at 85% in light, card at 85% in dark — and 0.5px divider rules above and below. Header padding is 20px on the sides. The wordmark sits at `h-8`.

## Elevation & Depth

Tonal layering first: four parchment steps and hairlines carry most of the depth. Content objects add a soft ambient shadow as a resting-state signature, not a hover effect — the "lifted paper" reading. Bottom sheets forgo shadow for a hard 1px top border, rounded top corners and a slide-up entrance, so they read as emerging from the screen edge. A heavier floating shadow is reserved for elements that overlay content.

### Shadow Vocabulary

- **Soft** (`box-shadow: 0 2px 8px rgba(31,28,15,0.04)` light / `0 2px 8px rgba(0,0,0,0.35)` dark): book covers and card-like content; `.elevated-soft`. Deepens on hover (`shadow-lg`).
- **Floating** (`box-shadow: 0 8px 40px rgba(0,0,0,0.5)` light / `0.65` dark): elements that overlay content; `.shadow-floating`. Never on bottom sheets.

### Named Rules

**The Resting Lift Rule.** Covers carry `.elevated-soft` at rest, not only on hover — depth says "physical object," not "interactive."

## Shapes

One corner language, graduated by role. **Controls take the small end:** buttons, menus, dialogs and sheet list items use `rounded-sm` (0.225rem); the search field uses `rounded-md` (0.3rem). **Content objects take the large end:** covers use `rounded-xl` (0.525rem); sheets use `rounded-t-3xl` (0.825rem) on the top edge only. Borders are hairlines (`0.5px` on the header, 1px elsewhere) in `border`/`divider`, never heavy. The mark and wordmark are the exception: built from straight, hard-edged strokes, with the one deliberate lean of the book and the I.

### Named Rules

**The Object/Control Split.** If the user reads or holds it (cover, sheet, popover), round it generously. If the user presses it (button, menu, dialog), round it modestly. The split is in degree, not sharp-vs-round.

## Components

### Buttons

- **Shape:** `rounded-sm` (0.225rem), at every size.
- **Sizes:** `xs` 24px, `sm` 28px, `default` 32px, `lg` 36px; icon buttons `icon` 32px, `icon-sm` 28px, `icon-lg` 36px square. Text is 12px at weight 500; `lg` is 14px.
- **Primary:** `bg-primary` / `text-primary-foreground`, hover `bg-primary/80`.
- **Secondary:** `bg-secondary` / `text-secondary-foreground`; hover mixes 5% foreground into the fill.
- **Outline:** edge in `border-input` (a control boundary, not decoration), background on `background` in light and `surface-high` in dark; hover to `muted`.
- **Ghost / Destructive / Link:** ghost is borderless with a muted hover fill; destructive uses a low-opacity tint (`bg-destructive/10`), not a solid fill; link is text-only with underline on hover.
- **Press and focus:** buttons nudge down 1px on press (`translate-y-px`). Focus is a 1px `ring` border plus a 50% `ring` outer ring, not a glow.

### Search Field

- **Style:** `card` fill, `rounded-md`, 10px by 12px padding, a 16px search icon and muted placeholder. Focus adds the 50% `ring` outline.

### Radio Rows

- **Style:** full-width rows, 16px padding, a check on the selected row. Group sits on `card` with `rounded-sm`; the selected state uses `selected` for the ring and check. Focus is an inset 1.5px `ring`.

### Cards / Book Covers

- **Corner Style:** `rounded-xl`, 2:3 aspect ratio, on a 160px minimum grid track.
- **Background:** cover image, or one of 30 palette gradients when there is no cover art.
- **Shadow Strategy:** `.elevated-soft` at rest, `shadow-lg` on hover.
- **Border:** hairline `border-border/40`.
- **Badges:** the "NEW" badge is a filled corner tab (`rounded-bl-xl`, translucent background), not a floating chip.

### Sheets / Drawers

- **Style:** slide up from the bottom edge, `rounded-t-3xl`, `bg-card`, no shadow, a hard top border.
- **Header:** a centered pill drag handle (64px by 4px, `bg-border`), a title in Cinzel 15px at 0.18em tracking, uppercase, over a bottom divider.
- **List items:** `Button` variants (`secondary` when active, `ghost` otherwise), left-aligned.

### Navigation / Header

- **Style:** sticky, translucent, blurred, with 0.5px divider rules top and bottom. The wordmark sits at the left; icon-only ghost buttons at the right with `aria-label`s; no visible text labels.
- **Tabs:** pill tabs in a `tab-strip` container, the active tab lifted onto a lighter fill with an underline.

### Logo

- **Mark:** three carved books (the right one leaning) over an open book, drawn in straight strokes. 16px minimum; below 48px the carved bands soften but the silhouette holds.
- **Wordmark:** carved capitals LIBRUNE, with a leaning book-spine I and an open-book U. 16px cap height minimum. Light grounds take ink; dark grounds take paper with the I and U in `logo-accent` gold.
- **App tile:** the gold mark on a rounded dark tile with a vertical `cover-dark` to background gradient; maskable icons are full-bleed with the mark inside an 80% safe zone.
- **Source:** `docs/brand/` holds the master SVGs and `BRAND.md`; `public/` holds the generated favicon and PWA icons.

## Do's and Don'ts

### Do:

- **Do** keep controls at the modest end of the radius scale (`rounded-sm`).
- **Do** give content objects (covers, sheets) rounded, softly lifted treatment: `.elevated-soft` plus `rounded-xl` / `rounded-3xl`.
- **Do** pair serif type (Cinzel, Literata) with anything the user reads, and sans (Plus Jakarta Sans) with anything the user operates.
- **Do** use the `--primary` token, never a hardcoded hex, for anything that must invert between light and dark.
- **Do** keep `cover-dark` and `cover-gold` to book-cover surfaces, the mark and the app tile.
- **Do** use `selected` only to mark active or checked state.
- **Do** use the logo files from `docs/brand/`, and leave the clear space of a quarter of the wordmark cap height around them.

### Don't:

- **Don't** round a button or chip to match a content object's radius.
- **Don't** add a drop shadow to bottom sheets.
- **Don't** introduce a cold neutral gray; all neutrals are warm parchment and ink tones.
- **Don't** use the sans UI font for reading-surface text, or the serif for buttons and nav.
- **Don't** use `warm-accent` or `selected` interchangeably with `cover-gold`: "book object," "CTA tile" and "active selection" are three separate signals.
- **Don't** put gold on a light ground, add gradients, shadows or outlines to the mark, straighten its lean, or rearrange its books.
- **Don't** reorder the cover palette list; book-to-palette assignment depends on it.
