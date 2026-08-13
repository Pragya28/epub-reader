/**
 * Strips HTML tags and collapses whitespace into single spaces. Shared by
 * tokenize.ts, snippet.ts, and search-service.ts so "what does chapter N's
 * plain text look like" has one implementation, not three that could drift.
 */
export function toPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
