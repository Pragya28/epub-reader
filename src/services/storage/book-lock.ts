/**
 * Serializes operations on the same bookId within one tab — closes the race
 * between deleteBook and rebuildSearchIndex/ensureIndex/buildIndex touching
 * the same book's dependent rows concurrently (e.g. a rebuild-in-flight
 * racing a delete). Cross-tab collisions already go through the separate
 * BroadcastChannel presence/progress mechanism (reading-progress-channel.ts)
 * and aren't handled here.
 *
 * ponytail: an in-memory Map, not a cross-tab lock — single-tab races only.
 * If cross-tab locking is ever needed, it would piggyback on that existing
 * channel rather than adding a new one.
 */
const locks = new Map<string, Promise<unknown>>();

export async function withBookLock<T>(
  bookId: string,
  fn: () => Promise<T>,
): Promise<T> {
  // The stored chain always resolves (see the .catch() below), so a plain
  // .then(fn) is enough — there's nothing for a second (rejection) handler
  // to catch here.
  const previous = locks.get(bookId) ?? Promise.resolve();
  const run = previous.then(fn);

  // Swallow rejection in the map's chain only — the caller still awaits
  // `run` below and sees the real error. Without this, one failed operation
  // would permanently poison the chain for every later operation on this
  // book, since an unhandled rejection propagates through `.then()`.
  locks.set(
    bookId,
    run.catch(() => undefined),
  );

  return run;
}
