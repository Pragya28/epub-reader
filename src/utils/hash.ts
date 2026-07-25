export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Deterministic, non-cryptographic string hash (djb2 variant). Same
 * input always produces the same non-negative integer output, in any
 * order, across renders/sessions/browsers.
 *
 * Use this instead of array index for anything that should stay stable
 * per-item (e.g. a book's cover color) regardless of sort order,
 * filtering, or additions/removals elsewhere in the list.
 */
export function hashString(value: string): number {
  let hash = 5381;

  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }

  // >>> 0 coerces to an unsigned 32-bit int, guaranteeing a
  // non-negative result regardless of sign overflow above.
  return hash >>> 0;
}
