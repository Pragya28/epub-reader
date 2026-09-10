/**
 * Trigger a browser download of an in-memory Blob. Object-URL + a
 * synthesized <a download> click is the only portable way — there is no
 * imperative "save this blob" API. The anchor never renders (removed
 * synchronously); the URL is revoked right after the click.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
