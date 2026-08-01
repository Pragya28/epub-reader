export const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "a",
    "abbr",
    "address",
    "article",
    "aside",
    "b",
    "blockquote",
    "br",
    "caption",
    "cite",
    "code",
    "col",
    "colgroup",
    "dd",
    "del",
    "div",
    "dl",
    "dt",
    "em",
    "figcaption",
    "figure",
    "footer",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hr",
    "i",
    "img",
    "ins",
    "li",
    "main",
    "mark",
    "nav",
    "ol",
    "p",
    "pre",
    "q",
    "s",
    "section",
    "small",
    "span",
    "strong",
    "sub",
    "sup",
    "svg",
    "image",
    "g",
    "defs",
    "use",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "time",
    "tr",
    "u",
    "ul",
  ],
  ALLOWED_ATTR: [
    "id",
    "class",
    "href",
    "xlink:href",
    "src",
    "alt",
    "title",
    "colspan",
    "rowspan",
    "lang",
    "dir",
    "loading",
    "viewBox",
    "width",
    "height",
    "preserveAspectRatio",
  ],
  /**
   * Decision: inline `style="..."` attributes and `<style>` blocks embedded
   * directly in chapter markup are intentionally NOT allowed (style isn't in
   * ALLOWED_ATTR; "style" is explicitly forbidden as a tag below too, for
   * belt-and-suspenders). Only linked stylesheets (chapter.stylesheets,
   * resolved via resolveCssAssets/sanitizeStylesheet) survive.
   *
   * Why: CSS can make real network requests with no JS at all — a
   * background-image url(https://...) fires the request purely from the
   * browser's own CSS engine, sandbox="allow-same-origin" doesn't block it,
   * and this app's entire premise is that nothing about what/how you're
   * reading gets uploaded to a server. Author-controlled inline styles are
   * far harder to audit for that (and for layout/UI-hijacking rules like
   * position:fixed) than a book's small number of linked stylesheets, which
   * already get resolved/rewritten by resolveCssAssets and stripped of
   * expression()/javascript:/@import by sanitizeStylesheet — and (as of the
   * accompanying fix) have any absolute url(https://...) neutralized rather
   * than passed through.
   *
   * Cost of this decision: any EPUB using inline `style=` for emphasis,
   * colored callouts, precise alignment, etc. loses that specific styling —
   * the text/structure still renders, just without the author's inline
   * tweaks. Reassess if that turns out to break real books in practice.
   */
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
  FORBID_ATTR: [
    "onerror",
    "onload",
    "onclick",
    "onmouseover",
    "onfocus",
    "onblur",
    "srcdoc",
    "formaction",
  ],
  // default DOMPurify URI allowlist doesn't include blob:, which is what
  // resolveChapterAssets rewrites <img src> to — extend it explicitly
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};
