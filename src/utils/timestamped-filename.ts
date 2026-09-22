/** A filesystem-safe "<prefix>-<ISO timestamp>.<ext>" filename — colons in
 * the timestamp (illegal in Windows filenames) are replaced with hyphens. */
export function timestampedFilename(prefix: string, ext: string): string {
  return `${prefix}-${new Date().toISOString().replace(/:/g, "-")}.${ext}`;
}
