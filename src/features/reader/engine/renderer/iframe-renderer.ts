export function renderIframe(
  iframe: HTMLIFrameElement,
  chapterHtml: string,
  stylesheets: string[],
) {
  const css = stylesheets.map((sheet) => `<style>${sheet}</style>`).join("");

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
