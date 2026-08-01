import { deriveOrnamentId, ORNAMENT_SVG_STRINGS } from "@/shared/ornaments";
import type { ReaderTheme } from "../../store/reader-preferences-store";

/**
 * Applies live font-scale/line-height/theme preferences to an already
 * -initialized iframe document by setting CSS custom properties and a
 * data-theme attribute, instead of rewriting srcdoc (which would drop
 * mounted chapters and scroll position).
 */
export function applyReaderPreferences(
  iframeDoc: Document,
  preferences: { fontScale: number; lineHeight: number; theme: ReaderTheme },
): void {
  const root = iframeDoc.documentElement;

  root.style.setProperty("--reading-font-scale", String(preferences.fontScale));
  root.style.setProperty(
    "--reading-line-height",
    String(preferences.lineHeight),
  );

  if (preferences.theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", preferences.theme);
  }
}

function sanitizeStylesheet(css: string): string {
  return css
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/url\s*\(\s*['"]?\s*javascript:[^)]*\)/gi, "url()")
    .replace(/@import[^;]+;/gi, "");
}

/**
 * The iframe is a separate document (written via srcdoc), so it does
 * NOT inherit the parent app's index.css custom properties — those only
 * apply to the outer document. Those values have to be re-declared here.
 *
 * These values are hand-mirrored from the `--color-*` / `--font-reading`
 * / `--reading-line-height` tokens in src/index.css (light + the
 * `prefers-color-scheme: dark` override block). If those tokens change,
 * update this constant too.
 *
 * Fonts are self-hosted (public/fonts/literata/, see the README there)
 * rather than loaded from the Google Fonts CDN: a CDN @font-face only
 * gets cached by the service worker's runtime-caching rule the first
 * time it's actually fetched, so a book opened offline before the reader
 * was ever opened online would fall back to system serif. Self-hosted
 * files under public/ are part of the app-shell precache manifest, so
 * they're guaranteed available from the very first offline read.
 */
const READER_FONTS_STYLE = `
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
`;

function buildReaderBaseStyle(bookId?: string): string {
  const baseStyle = `
  :root {
    color-scheme: light dark;
    --sep-ink:  #695d4a;
    --sep-fade: #fff9ee;
    --sep-text: #1f1c0f;
    --reading-font-scale: 1;
    --reading-line-height: 1.6;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --sep-ink:  #cbb98e;
      --sep-fade: #141210;
      --sep-text: #f2ead8;
    }
  }

  /* Explicit theme choice wins over the OS-level prefers-color-scheme. */
  :root[data-theme="light"] {
    --sep-ink:  #695d4a;
    --sep-fade: #fff9ee;
    --sep-text: #1f1c0f;
  }

  :root[data-theme="dark"] {
    --sep-ink:  #cbb98e;
    --sep-fade: #141210;
    --sep-text: #f2ead8;
  }

  html, body {
    overflow-x: hidden;
  }

  body {
    margin: 0 !important;
    font-family: "Literata", serif !important;
    font-size: calc(1rem * var(--reading-font-scale)) !important;
    line-height: var(--reading-line-height);
    background: var(--sep-fade);
    color: var(--sep-text) !important;
    padding: 0 16px;
    box-sizing: border-box;
    overflow-wrap: break-word;
  }

  body * {
    font-family: "Literata", serif !important;
    color: var(--sep-text) !important;
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
`;

  if (!bookId) {
    return baseStyle;
  }

  // Derive ornament SVG from bookId
  const ornamentId = deriveOrnamentId(bookId);
  const chapterSeparatorSvg = ORNAMENT_SVG_STRINGS[ornamentId];

  // Create light and dark versions of the SVG by replacing currentColor with theme-specific colors
  const lightSvg = chapterSeparatorSvg.replace(/currentColor/g, "#695d4a");
  const darkSvg = chapterSeparatorSvg.replace(/currentColor/g, "#cbb98e");

  // Encode both versions as data URIs
  const encodedLightSvg = encodeURIComponent(lightSvg);
  const encodedDarkSvg = encodeURIComponent(darkSvg);

  const separatorStyle = `
  /* ── Chapter separator using book's ornament ──────────────────────── */
  section[data-chapter] + section[data-chapter]::before {
    content: "";
    display: block;
    height: 2rem;
    margin-block: 2rem;
    pointer-events: none;

    background-image: url("data:image/svg+xml,${encodedLightSvg}");
    background-repeat: no-repeat;
    background-position: center center;
    background-size: contain;
  }

  @media (prefers-color-scheme: dark) {
    section[data-chapter] + section[data-chapter]::before {
      background-image: url("data:image/svg+xml,${encodedDarkSvg}");
    }
  }
`;

  return baseStyle + separatorStyle;
}

/**
 * Writes the initial (empty-body) document shell into the iframe, with
 * all book stylesheets injected into <head>. Called once per reader
 * session — subsequent chapters are appended via mountChapterSection,
 * NOT by re-writing srcdoc (which would destroy scroll position and
 * previously-mounted chapters).
 *
 * Our base theme/font styles are written before the book's own
 * stylesheets so publisher CSS (e.g. a body { font-family } rule) still
 * wins where it's actually specified — ours is just the fallback.
 */
export function initializeReaderDocument(
  iframe: HTMLIFrameElement,
  stylesheets: string[],
  bookId?: string,
): void {
  const bookCss = stylesheets
    .map((sheet) => `<style>${sanitizeStylesheet(sheet)}</style>`)
    .join("");

  const readerBaseStyle = buildReaderBaseStyle(bookId);

  iframe.srcdoc = `
  <!doctype html>
  <html>
    <head>
      <style>${READER_FONTS_STYLE}</style>
      <style>${readerBaseStyle}</style>
      ${bookCss}
    </head>
    <body></body>
  </html>
`;
}

/**
 * Inserts a single chapter's already-sanitized HTML as a <section
 * data-chapter="index"> into the iframe's existing document, in the
 * correct spine position relative to already-mounted chapters.
 *
 * Requires the iframe document to already exist (call
 * initializeReaderDocument first, and wait for iframe.contentDocument
 * to be ready — srcdoc writes are async).
 */
export function mountChapterSection(
  iframeDoc: Document,
  chapterHtml: string,
  index: number,
): void {
  if (iframeDoc.querySelector(`section[data-chapter="${index}"]`)) return;

  const section = iframeDoc.createElement("section");
  section.setAttribute("data-chapter", String(index));
  section.innerHTML = chapterHtml;

  // Inline onerror attributes are stripped by the sanitizer (rightly so —
  // it's a script-injection vector), so broken images need a real listener
  // instead. Hide rather than leave the browser's broken-image icon.
  section.querySelectorAll("img").forEach((img) => {
    img.addEventListener("error", () => {
      img.style.display = "none";
    });
  });

  let inserted = false;

  iframeDoc.querySelectorAll("section[data-chapter]").forEach((existing) => {
    const existingIndex = Number(existing.getAttribute("data-chapter"));
    if (!inserted && existingIndex > index) {
      iframeDoc.body.insertBefore(section, existing);
      inserted = true;
    }
  });

  if (!inserted) iframeDoc.body.appendChild(section);
}

export function unmountChapterSection(
  iframeDoc: Document,
  index: number,
): void {
  iframeDoc.querySelector(`section[data-chapter="${index}"]`)?.remove();
}
