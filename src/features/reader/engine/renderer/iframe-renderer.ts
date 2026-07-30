import { deriveOrnamentId, ORNAMENT_SVG_STRINGS } from "@/shared/ornaments";

function sanitizeStylesheet(css: string): string {
  return css
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/url\s*\(\s*['"]?\s*javascript:[^)]*\)/gi, "url()")
    .replace(/@import[^;]+;/gi, "");
}

/**
 * The iframe is a separate document (written via srcdoc), so it does
 * NOT inherit the parent app's index.css custom properties or its
 * Google Fonts <link> — those only apply to the outer document. Both
 * have to be re-declared here.
 *
 * These values are hand-mirrored from the `--color-*` / `--font-reading`
 * / `--reading-line-height` tokens in src/index.css (light + the
 * `prefers-color-scheme: dark` override block). If those tokens change,
 * update this constant too.
 */
const READER_FONTS_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,300..900&display=swap">';

function buildReaderBaseStyle(bookId?: string): string {
  const baseStyle = `
  :root {
    color-scheme: light dark;

    --sep-ink:  #695d4a;
    --sep-fade: #fff9ee;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --sep-ink:  #cbb98e;
      --sep-fade: #141210;
    }
  }

  body {
    margin: 0;
    font-family: "Literata", serif !important;
    line-height: 1.6;
    background: var(--sep-fade);
    color: #1f1c0f !important;
  }

  body * {
    font-family: "Literata", serif !important;
    color: #1f1c0f !important;
  }

  @media (prefers-color-scheme: dark) {
    body,
    body * {
      color: #f2ead8 !important;
    }
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
      ${READER_FONTS_LINK}
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
