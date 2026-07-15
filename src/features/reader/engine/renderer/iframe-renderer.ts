function sanitizeStylesheet(css: string): string {
  return (
    css
      // block CSS expression() (legacy IE vector, cheap to strip regardless)
      .replace(/expression\s*\([^)]*\)/gi, "")
      // block javascript: urls inside CSS url()
      .replace(/url\s*\(\s*['"]?\s*javascript:[^)]*\)/gi, "url()")
      // block @import (avoid pulling in unexpected external stylesheets)
      .replace(/@import[^;]+;/gi, "")
  );
}

export function renderIframe(
  iframe: HTMLIFrameElement,
  chapterHtml: string,
  stylesheets: string[],
) {
  const css = stylesheets
    .map((sheet) => `<style>${sanitizeStylesheet(sheet)}</style>`)
    .join("");

  iframe.srcdoc = `
    <!doctype html>
    <html>
      <head>
        ${css}
      </head>
      <body>
        ${chapterHtml}
      </body>
    </html>
  `;
}
