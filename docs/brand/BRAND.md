# Librune brand kit

The Librune identity is two pieces: the **mark** (three carved books standing behind an open book) and the **wordmark** (carved capitals with a leaning book-spine I and an open-book U). Both are drawn from straight strokes so they read like carved runes without being real runes.

Design canvas with concepts, tests and lockups: https://claude.ai/artifact/TbhFM2YoVRktjjJXfK3kRW

## Files

| File                    | Use                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `mark.svg`              | Mark alone, `currentColor`. Inline it and set `color`.                                 |
| `app-icon.svg`          | Mark in cover gold on the dark cover tile, rounded. Source for favicons and app icons. |
| `app-icon-maskable.svg` | Full-bleed square tile, mark inside the 80% safe zone. Source for maskable PWA icons.  |
| `wordmark.svg`          | Wordmark, `currentColor`.                                                              |
| `wordmark-light.svg`    | Wordmark in ink, for parchment backgrounds.                                            |
| `wordmark-dark.svg`     | Wordmark in paper with the I and U in cover gold, for dark backgrounds.                |
| `lockup-horizontal.svg` | Mark + wordmark side by side, `currentColor`.                                          |
| `lockup-stacked.svg`    | Mark above wordmark, `currentColor`.                                                   |

Shipped in `public/`, generated from `app-icon.svg` / `app-icon-maskable.svg`:

- `favicon.svg` (modern browsers), `favicon.ico` (16, 32, 48)
- `icon-192.png`, `icon-512.png` (manifest `any`)
- `icon-192-maskable.png`, `icon-512-maskable.png` (manifest `maskable`)
- `apple-touch-icon.png` (180, opaque square, iOS rounds it)

All files are outlined paths: no live text, fonts, filters or raster images.

## Colour

| Role                       | Token                | HEX       | RGB         | CMYK (approx.) |
| -------------------------- | -------------------- | --------- | ----------- | -------------- |
| Mark on tile, gold accents | `cover-gold`         | `#C9A84C` | 201 168 76  | 0 16 62 21     |
| Tile, top                  | `cover-dark`         | `#2B241C` | 43 36 28    | 0 16 35 83     |
| Tile, bottom               | `background` (dark)  | `#141210` | 20 18 16    | 0 10 20 92     |
| Ink                        | `foreground` (light) | `#1F1C0F` | 31 28 15    | 0 10 52 88     |
| Paper                      | `foreground` (dark)  | `#F2EAD8` | 242 234 216 | 0 3 11 5       |
| Parchment ground           | `background` (light) | `#FFF9EE` | 255 249 238 | 0 2 7 0        |

CMYK values are straight conversions, not press-proofed; no Pantone match has been chosen. Get a proof before printing.

Contrast (WCAG): gold on tile top 6.7:1, gold on tile bottom 8.2:1, ink on parchment 16.3:1, paper on dark 15.6:1. **Gold on parchment is 2.2:1: never put the gold mark or gold letters on a light ground.** On light grounds use ink.

Gold stays a book-object colour, as the design system requires: it appears only on the mark, the app tile and the two book letters (I, U) of the dark wordmark, never on UI chrome.

## Clear space and minimum sizes

- Clear space around the wordmark and lockups: **a quarter of the wordmark cap height** on every side. Around the mark alone: a quarter of its height.
- Mark: 16 px minimum (favicon). Below 48 px the carved bands soften; the silhouette still reads.
- Wordmark: 16 px cap height minimum. Below 24 px the page inside the U merges into the U; that is expected.
- App tile: use as provided; don't re-crop.

## Approved backgrounds

- Parchment (`#FFF9EE`, `card`, `surface-*`): ink mark, ink wordmark, ink lockups.
- Dark (`#141210`, `card` dark): paper wordmark with gold I and U, gold mark.
- Book covers and photos: only on the app tile.

## Don't

- Don't set "Librune" in Cinzel or any font as the logo; use the wordmark files.
- Don't recolour outside the palette above or add gradients, shadows or outlines to the mark (the tile gradient is part of the tile).
- Don't straighten the leaning book or the leaning I; the lean is the signature.
- Don't use gold on light backgrounds.
- Don't stretch, rotate or rearrange the books, or separate the open book from them.
- Don't place the mark on the tile at a different scale than `app-icon.svg`.

## Typography with the logo

The wordmark replaces type for the name. Around it, use the design system: Cinzel for headings, Plus Jakarta Sans for UI. Both are on Google Fonts under the SIL Open Font License, which permits this use.

## Open items

- No trademark search has been done. Get a professional clearance search before registering or using the name and mark commercially.
- The design system's README still says "draw no mark"; update it to point at this kit.
