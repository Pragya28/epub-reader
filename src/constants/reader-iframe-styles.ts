/**
 * Reader iframe (services/reader/engine/renderer/iframe-renderer.ts) hand-mirrors
 * its own styling separately from src/index.css — see the note there for why.
 * The purely static, hardcoded CSS/data lives here; the logic that composes it
 * (per-book ornament SVGs, cache-busting, etc.) stays in iframe-renderer.ts.
 */

/** Ink/paper colors for the chapter-separator ornament and --sep-* CSS vars. */
export const SEPARATOR_COLOR_LIGHT = "oklch(48.45% 0.0329 79.18)";
export const SEPARATOR_COLOR_DARK = "oklch(79.03% 0.0611 87.95)";

/**
 * Fonts are self-hosted (public/fonts/<name>/, see each README) rather
 * than loaded from the Google Fonts CDN: a CDN @font-face only gets
 * cached by the service worker's runtime-caching rule the first time
 * it's actually fetched, so a book opened offline before the reader was
 * ever opened online would fall back to system serif. Self-hosted files
 * under public/ are part of the app-shell precache manifest, so they're
 * guaranteed available from the very first offline read.
 *
 * Literata is self-hosted as a full variable font (weight axis + italic);
 * the three reader-font alternatives (Lora, DM Sans, Atkinson Hyperlegible)
 * are only self-hosted at weight 400 — see the "no font-weight scale"
 * decision in tasks/SPRINT-05-TASKS.md. Bold/italic for those three fall
 * back to browser synthesis, an acceptable trade for a secondary font choice.
 */
export const READER_FONTS_STYLE = `
  @font-face {
    font-family: "Literata";
    font-style: normal;
    font-display: swap;
    font-weight: 200 900;
    src: url("/fonts/literata/literata-latin-wght-normal.woff2") format("woff2-variations");
    unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;
  }
  @font-face {
    font-family: "Literata";
    font-style: normal;
    font-display: swap;
    font-weight: 200 900;
    src: url("/fonts/literata/literata-latin-ext-wght-normal.woff2") format("woff2-variations");
    unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;
  }
  @font-face {
    font-family: "Literata";
    font-style: italic;
    font-display: swap;
    font-weight: 200 900;
    src: url("/fonts/literata/literata-latin-wght-italic.woff2") format("woff2-variations");
    unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;
  }
  @font-face {
    font-family: "Literata";
    font-style: italic;
    font-display: swap;
    font-weight: 200 900;
    src: url("/fonts/literata/literata-latin-ext-wght-italic.woff2") format("woff2-variations");
    unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;
  }
  @font-face {
    font-family: "Lora";
    font-style: normal;
    font-display: swap;
    font-weight: 400;
    src: url("/fonts/lora/lora-latin-400.woff2") format("woff2");
    unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;
  }
  @font-face {
    font-family: "Lora";
    font-style: normal;
    font-display: swap;
    font-weight: 400;
    src: url("/fonts/lora/lora-latin-ext-400.woff2") format("woff2");
    unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;
  }
  @font-face {
    font-family: "DM Sans";
    font-style: normal;
    font-display: swap;
    font-weight: 400;
    src: url("/fonts/dm-sans/dm-sans-latin-400.woff2") format("woff2");
    unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;
  }
  @font-face {
    font-family: "DM Sans";
    font-style: normal;
    font-display: swap;
    font-weight: 400;
    src: url("/fonts/dm-sans/dm-sans-latin-ext-400.woff2") format("woff2");
    unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;
  }
  @font-face {
    font-family: "Atkinson Hyperlegible";
    font-style: normal;
    font-display: swap;
    font-weight: 400;
    src: url("/fonts/atkinson-hyperlegible/atkinson-latin-400.woff2") format("woff2");
    unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;
  }
  @font-face {
    font-family: "Atkinson Hyperlegible";
    font-style: normal;
    font-display: swap;
    font-weight: 400;
    src: url("/fonts/atkinson-hyperlegible/atkinson-latin-ext-400.woff2") format("woff2");
    unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;
  }
`;

/**
 * The iframe is a separate document (written via srcdoc), so it does
 * NOT inherit the parent app's index.css custom properties — those only
 * apply to the outer document. Those values have to be re-declared here.
 *
 * These values are hand-mirrored from the `--color-*` / `--font-reading`
 * / `--reading-line-height` tokens in src/index.css (light + the
 * `prefers-color-scheme: dark` override block). If those tokens change,
 * update this constant too.
 */
export const READER_BASE_STYLE = `
  :root {
    color-scheme: light dark;
    --sep-ink:  ${SEPARATOR_COLOR_LIGHT};
    --sep-fade: oklch(98.38% 0.0159 82.79);
    --sep-text: oklch(22.57% 0.0237 96.74);
    --reading-font-scale: 1;
    --reading-line-height: 1.6;
    --reading-font-family: "Literata", serif;
    --reading-margin: 16px;
    --reading-paragraph-spacing: 8px;
    /* Mirrors --cover-gold / --selected from src/index.css. */
    --search-highlight-bg: oklch(74.32% 0.1171 89.51 / 35%);
    --search-highlight-text: oklch(58.07% 0.1046 78.37);
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --sep-ink:  ${SEPARATOR_COLOR_DARK};
      --sep-fade: oklch(18.38% 0.0052 67.5);
      --sep-text: oklch(93.85% 0.0254 86.87);
      --search-highlight-text: oklch(77.53% 0.123 78.89);
    }
  }

  /* Explicit theme choice wins over the OS-level prefers-color-scheme. */
  :root[data-theme="light"] {
    --sep-ink:  ${SEPARATOR_COLOR_LIGHT};
    --sep-fade: oklch(98.38% 0.0159 82.79);
    --sep-text: oklch(22.57% 0.0237 96.74);
    --search-highlight-text: oklch(58.07% 0.1046 78.37);
  }

  :root[data-theme="dark"] {
    --sep-ink:  ${SEPARATOR_COLOR_DARK};
    --sep-fade: oklch(18.38% 0.0052 67.5);
    --sep-text: oklch(93.85% 0.0254 86.87);
    --search-highlight-text: oklch(77.53% 0.123 78.89);
  }

  html, body {
    overflow-x: hidden;
  }

  body {
    margin: 0 !important;
    font-family: var(--reading-font-family) !important;
    font-size: calc(1rem * var(--reading-font-scale)) !important;
    line-height: var(--reading-line-height);
    /* !important: publisher CSS is deliberately allowed to win on
       font-family (that's a stylistic choice), but never on background —
       a book stylesheet that hardcodes e.g. "background-color: white"
       (common in Project Gutenberg EPUBs) would otherwise survive our
       theme and pair with our forced (!important) --sep-text color,
       silently rendering near-invisible text in dark mode. */
    background: var(--sep-fade) !important;
    color: var(--sep-text) !important;
    padding: 120px var(--reading-margin);
    box-sizing: border-box;
    overflow-wrap: break-word;
  }

  body * {
    font-family: var(--reading-font-family) !important;
    color: var(--sep-text) !important;
  }

  p {
    margin-block-end: var(--reading-paragraph-spacing);
  }

  img, svg {
    max-width: 100%;
    height: auto;
  }

  /* overflow-x: hidden on body clips wide content instead of letting the
     page scroll sideways — but that would silently hide the overflowing
     part of a wide code block entirely. Give it its own local horizontal
     scroll instead so nothing is lost, just contained. */
  pre {
    max-width: 100%;
    overflow-x: auto;
  }

  mark.search-highlight {
    background: var(--search-highlight-bg) !important;
    color: var(--search-highlight-text) !important;
    font-weight: 600;
    padding: 0 2px;
    /* Mirrors --radius-sm (0.375rem * 0.6) from src/index.css. */
    border-radius: 0.225rem;
  }
`;
