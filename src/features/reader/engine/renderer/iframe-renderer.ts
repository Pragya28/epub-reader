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

const READER_BASE_STYLE = `
  :root {
    color-scheme: light dark;
  }

  body {
    margin: 0;
    font-family: "Literata", serif !important;
    line-height: 1.6;
    background: #fff9ee;
    color: #1f1c0f;
  }

  body * {
    font-family: "Literata", serif !important;
  }

  @media (prefers-color-scheme: dark) {
    body {
      background: #141210;
      color: #f2ead8;
    }
  }
`;

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
): void {
  const bookCss = stylesheets
    .map((sheet) => `<style>${sanitizeStylesheet(sheet)}</style>`)
    .join("");

  iframe.srcdoc = `
  <!doctype html>
  <html>
    <head>
      ${READER_FONTS_LINK}
      <style>${READER_BASE_STYLE}</style>
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
  section.style.marginBottom = "48px";
  section.style.borderBottom = "1px solid";
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
