import { db } from "@/services/storage/db";
import { getAllBooks } from "@/services/storage/book-repository";
import { listBookFileIds, deleteBookFile } from "@/services/storage/book-files";
import { logger as rootLogger } from "@/shared/logger/logger";

const logger = rootLogger.child("reconcile");

export interface ReconcileResult {
  searchIndexRows: number;
  chapterTextRows: number;
  groupingMemberRows: number;
  bookFiles: number;
}

/**
 * Sweeps for dependent rows left behind by a delete whose best-effort
 * cleanup failed partway (see delete-book.ts) or a rolled-back import — a
 * searchIndex/chapterText/groupingMembers row, or a legacy bookFiles blob,
 * pointing at a bookId no longer in `books`. Manual, not automatic: exposed
 * as a Settings → Storage "Repair library" action, the same posture as
 * "Rebuild search index".
 *
 * Series membership already gets pruned by deleteMembersForBook at delete
 * time (this only catches what that step itself failed to clean up).
 * Collection membership has no other path back to consistency — an orphaned
 * groupingMembers row for a collection is gone for good once this runs.
 */
export async function reconcileOrphanedRows(): Promise<ReconcileResult> {
  const liveBookIds = new Set((await getAllBooks()).map((book) => book.id));

  const result: ReconcileResult = {
    searchIndexRows: 0,
    chapterTextRows: 0,
    groupingMemberRows: 0,
    bookFiles: 0,
  };

  try {
    result.searchIndexRows = await db.searchIndex
      .filter((entry) => !liveBookIds.has(entry.bookId))
      .delete();
  } catch (error) {
    logger.error("failed to sweep orphaned searchIndex rows", error);
  }

  try {
    result.chapterTextRows = await db.chapterText
      .filter((entry) => !liveBookIds.has(entry.bookId))
      .delete();
  } catch (error) {
    logger.error("failed to sweep orphaned chapterText rows", error);
  }

  try {
    result.groupingMemberRows = await db.groupingMembers
      .filter((member) => !liveBookIds.has(member.bookId))
      .delete();
  } catch (error) {
    logger.error("failed to sweep orphaned groupingMembers rows", error);
  }

  try {
    const fileIds = await listBookFileIds();
    const orphanedFileIds = [...fileIds].filter((id) => !liveBookIds.has(id));
    for (const bookId of orphanedFileIds) {
      await deleteBookFile(bookId);
      result.bookFiles += 1;
    }
  } catch (error) {
    logger.error("failed to sweep orphaned book files", error);
  }

  return result;
}
