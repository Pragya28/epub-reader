/**
 * Cross-tab awareness for reading progress. `updateBookProgress`
 * (book-repository.ts) is a plain last-write-wins Dexie update with no
 * cross-tab coordination — two tabs open on the same book can each save
 * progress with neither aware of the other, so a backgrounded tab's next
 * stale save can silently clobber a newer one. This channel makes that
 * visible: every tab announces itself and every save it makes, so a
 * listener can prompt the user instead of silently losing progress.
 *
 * Feature-detected/fail-soft, same posture as use-wake-lock.ts and
 * storage-quota.ts — a browser without BroadcastChannel just gets no
 * cross-tab awareness, never a thrown error.
 */
import type { ReadingProgress } from "@/services/storage/storage-types";

const CHANNEL_NAME = "librune-reading-progress";

export const TAB_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export type ReadingProgressMessage =
  | { type: "presence"; bookId: string; tabId: string }
  | {
      type: "progress";
      bookId: string;
      progress: ReadingProgress;
      tabId: string;
    };

function openChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
}

const channel = openChannel();

function postMessage(message: ReadingProgressMessage): void {
  try {
    channel?.postMessage(message);
  } catch {
    // Channel closed/unavailable — cross-tab awareness is best-effort.
  }
}

/** Announces that this tab has the given book open, so any other tab
 * already reading it can surface the "also open elsewhere" notice. */
export function postPresence(bookId: string): void {
  postMessage({ type: "presence", bookId, tabId: TAB_ID });
}

/** Announces a saved progress snapshot, so another tab on the same book
 * can tell its own save would be stale. */
export function postProgressUpdate(
  bookId: string,
  progress: ReadingProgress,
): void {
  postMessage({ type: "progress", bookId, progress, tabId: TAB_ID });
}

/** Subscribes to messages from other tabs. Returns an unsubscribe
 * function; a no-op when BroadcastChannel is unavailable. */
export function subscribeToReadingProgressChannel(
  handler: (message: ReadingProgressMessage) => void,
): () => void {
  if (!channel) return () => {};

  const listener = (event: MessageEvent<ReadingProgressMessage>) => {
    handler(event.data);
  };
  channel.addEventListener("message", listener);
  return () => channel.removeEventListener("message", listener);
}
