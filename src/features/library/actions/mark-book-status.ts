import {
  updateBookManualStatus,
  resetBookProgress,
} from "@/services/storage/book-repository";
import { libraryStore } from "../store/library-store";
import type { StoredBook } from "@/services/storage/storage-types";

function patchBook(bookId: string, patch: Partial<StoredBook>) {
  libraryStore
    .getState()
    .setBooks(
      libraryStore
        .getState()
        .books.map((b) => (b.id === bookId ? { ...b, ...patch } : b)),
    );
}

export async function markBookFinished(bookId: string): Promise<void> {
  await updateBookManualStatus(bookId, "finished");
  patchBook(bookId, { manualStatus: "finished" });
}

export async function markBookUnread(bookId: string): Promise<void> {
  await updateBookManualStatus(bookId, "unread");
  patchBook(bookId, { manualStatus: "unread" });
}

export async function startBookAtBeginning(bookId: string): Promise<void> {
  await resetBookProgress(bookId);
  patchBook(bookId, { progress: undefined, manualStatus: undefined });
}
