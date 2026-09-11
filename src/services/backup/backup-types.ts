import type {
  AppTheme,
  ReaderFontId,
} from "@/features/preferences/types/preferences.types";
import type {
  Grouping,
  GroupingMember,
  StoredBook,
} from "@/services/storage/storage-types";

/** The backup *format* version — the only thing import compatibility keys
 * on. Standalone integer, unrelated to any app version (there isn't one at
 * runtime yet — Sprint 8 Day 7). Bump only on a breaking manifest change. */
export const BACKUP_VERSION = 1;

/** All ten persisted `preferencesStore` keys, snapshotted whole. */
export interface PreferencesSnapshot {
  theme: AppTheme;
  applyThemeToReader: boolean;
  readerFont: ReaderFontId;
  readerTheme: AppTheme;
  fontScale: number;
  lineHeight: number;
  margins: number;
  paragraphSpacing: number;
  keepScreenAwake: boolean;
  keepScreenAwakeMinutes: number;
}

export interface BackupManifest {
  version: number;
  exportedAt: number;
  books: StoredBook[];
  groupings: Grouping[];
  groupingMembers: GroupingMember[];
  preferences: PreferencesSnapshot;
}

/** In-memory form of an archive: the manifest plus the raw blobs, both
 * maps keyed by the manifest book `id`. */
export interface BackupData {
  manifest: BackupManifest;
  files: Map<string, Blob>;
  covers: Map<string, Blob>;
}

/** Thrown by readArchive for anything that isn't a readable current-or-older
 * Librune backup. Carries a user-facing message. */
export class BackupFormatError extends Error {}
