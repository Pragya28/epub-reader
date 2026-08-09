import { deriveOrnamentId, ORNAMENT_SVG_STRINGS } from "@/shared/ornaments";
import type {
  AppTheme,
  ReaderFontId,
} from "@/features/preferences/types/preferences.types";
import { getReaderFont } from "@/features/preferences/constants/reader-fonts";
import {
  READER_BASE_STYLE,
  READER_FONTS_STYLE,
  SEPARATOR_COLOR_DARK,
  SEPARATOR_COLOR_LIGHT,
} from "@/constants/reader-iframe-styles";

/**
 * Applies live reading preferences to an already-initialized iframe
 * document by setting CSS custom properties and a data-theme attribute,
 * instead of rewriting srcdoc (which would drop mounted chapters and
 * scroll position). `theme` here is already the *effective* theme
 * (resolved from `applyThemeToReader` by the caller), not the raw store
 * field.
 */
export function applyReaderPreferences(
  iframeDoc: Document,
  preferences: {
    fontScale: number;
    lineHeight: number;
    theme: AppTheme;
    font: ReaderFontId;
    margins: number;
    paragraphSpacing: number;
  },
): void {
  const root = iframeDoc.documentElement;

  root.style.setProperty("--reading-font-scale", String(preferences.fontScale));
  root.style.setProperty(
    "--reading-line-height",
    String(preferences.lineHeight),
  );
  root.style.setProperty(
    "--reading-font-family",
    getReaderFont(preferences.font).cssFontFamily,
  );
  root.style.setProperty("--reading-margin", `${preferences.margins}px`);
  root.style.setProperty(
    "--reading-paragraph-spacing",
    `${preferences.paragraphSpacing}px`,
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

function buildReaderBaseStyle(bookId?: string): string {
  if (!bookId) {
    return READER_BASE_STYLE;
  }

  // Derive ornament SVG from bookId
  const ornamentId = deriveOrnamentId(bookId);
  const chapterSeparatorSvg = ORNAMENT_SVG_STRINGS[ornamentId];

  // Create light and dark versions of the SVG by replacing currentColor with theme-specific colors
  const lightSvg = chapterSeparatorSvg.replace(
    /currentColor/g,
    SEPARATOR_COLOR_LIGHT,
  );
  const darkSvg = chapterSeparatorSvg.replace(
    /currentColor/g,
    SEPARATOR_COLOR_DARK,
  );

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

  return READER_BASE_STYLE + separatorStyle;
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
 * wins where it's actually specified — ours is just the fallback. The
 * one exception is `background` (see reader-iframe-styles.ts): that one
 * is forced with !important, because losing it to a publisher's
 * hardcoded `background-color: white` pairs badly with our
 * equally-forced --sep-text and renders the page illegible in dark mode.
 */
export function initializeReaderDocument(
  iframe: HTMLIFrameElement,
  stylesheets: string[],
  bookId?: string,
  language?: string | null,
): void {
  const bookCss = stylesheets
    .map((sheet) => `<style>${sanitizeStylesheet(sheet)}</style>`)
    .join("");

  const readerBaseStyle = buildReaderBaseStyle(bookId);

  // The book's own language, so a screen reader pronounces the prose with the
  // right voice (WCAG 3.1.1). Omitted rather than guessed when the EPUB
  // doesn't declare one — a wrong lang is worse than none. Metadata is
  // untrusted, so this is shape-checked against BCP 47 rather than escaped:
  // anything that isn't a plain language tag is dropped, not sanitized.
  const langAttr =
    language && /^[a-z]{2,8}(-[a-z0-9]{1,8})*$/i.test(language)
      ? ` lang="${language}"`
      : "";

  iframe.srcdoc = `
  <!doctype html>
  <html${langAttr}>
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
