const cache = new Map<string, string>();

export function getCachedCoverUrl(bookId: string): string | undefined {
  return cache.get(bookId);
}

export function cacheCoverUrl(bookId: string, blob: Blob): string {
  const existing = cache.get(bookId);

  if (existing) {
    return existing;
  }

  const url = URL.createObjectURL(blob);

  cache.set(bookId, url);

  return url;
}

export function revokeCoverUrl(bookId: string): void {
  const url = cache.get(bookId);

  if (!url) return;

  URL.revokeObjectURL(url);

  cache.delete(bookId);
}

export function revokeAllCoverUrls(): void {
  for (const url of cache.values()) {
    URL.revokeObjectURL(url);
  }

  cache.clear();
}
