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
    color: #1f1c0f;
  }

  body * {
    font-family: "Literata", serif !important;
  }

  @media (prefers-color-scheme: dark) {
    body {
      color: #f2ead8;
    }
  }

  /* ── Chapter separator ─────────────────────────────────────────────
     A single ::before pseudo-element on every section[data-chapter]
     except the first, using three composited background layers:

       1. A centred SVG fleuron (❧ U+2767) rendered in Cinzel —
          Librune's own display face — so the ornament is unmistakably
          part of this app's typographic identity.
       2. Left ruled arm: 1 px gradient, fades to transparent at the
          left margin so the line dissolves into the page.
       3. Right ruled arm: mirror of the left.

     Both arms are sized to stop 28 px short of centre, ensuring they
     never overdraw the glyph. Colour is driven by --sep-ink, so dark
     mode is handled purely in CSS. The SVG fill is hard-coded per theme
     because data-URI backgrounds cannot read CSS custom properties —
     only the gradient layers use var(--sep-ink).

     No border, no box, no shadow — ink on parchment.
  ─────────────────────────────────────────────────────────────────── */

  section[data-chapter] + section[data-chapter]::before {
    content: "";
    display: block;
    height: 4.5rem;
    margin-block: 3.5rem;
    pointer-events: none;

    /* Layer order: topmost first (glyph above rule arms). */
    background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='36'%3E%3Ctext x='50%25' y='72%25' text-anchor='middle' font-family='Cinzel%2C serif' font-size='22' fill='%23695d4a'%3E%E2%9D%A7%3C/text%3E%3C/svg%3E"),
      linear-gradient(to right, transparent 0%, var(--sep-ink) 40%, var(--sep-ink) 100%),
      linear-gradient(to left,  transparent 0%, var(--sep-ink) 40%, var(--sep-ink) 100%);

    background-repeat:   no-repeat, no-repeat, no-repeat;
    background-position: center center, left center, right center;
    background-size:
      48px 36px,
      calc(50% - 28px) 1px,
      calc(50% - 28px) 1px;
  }

  /* Dark mode: swap the SVG fill colour only.
     Gradient arms already use var(--sep-ink), updated above in :root. */
  @media (prefers-color-scheme: dark) {
    section[data-chapter] + section[data-chapter]::before {
      background-image:
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='36'%3E%3Ctext x='50%25' y='72%25' text-anchor='middle' font-family='Cinzel%2C serif' font-size='22' fill='%23cbb98e'%3E%E2%9D%A7%3C/text%3E%3C/svg%3E"),
        linear-gradient(to right, transparent 0%, var(--sep-ink) 40%, var(--sep-ink) 100%),
        linear-gradient(to left,  transparent 0%, var(--sep-ink) 40%, var(--sep-ink) 100%);
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
