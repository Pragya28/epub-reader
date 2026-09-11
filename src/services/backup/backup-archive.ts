import JSZip from "jszip";
import {
  BACKUP_VERSION,
  BackupFormatError,
  type BackupData,
  type BackupManifest,
} from "./backup-types";

const MANIFEST = "manifest.json";
const BOOKS_DIR = "books/";
const COVERS_DIR = "covers/";
const EPUB_EXT = ".epub";

const NOT_A_BACKUP = "This file isn't a Librune backup.";

export async function createArchive(data: BackupData): Promise<Blob> {
  const zip = new JSZip();
  zip.file(MANIFEST, JSON.stringify(data.manifest, null, 2));

  for (const [bookId, file] of data.files) {
    zip.file(`${BOOKS_DIR}${bookId}${EPUB_EXT}`, file);
  }
  for (const [bookId, cover] of data.covers) {
    zip.file(`${COVERS_DIR}${bookId}`, cover);
  }

  /* No compression — the archive's bulk is already-compressed EPUB files,
     so DEFLATE barely shrinks it but adds JSZip's async Flate-worker
     pipeline, which produced flaky unhandled-exception failures on CPU-
     constrained CI runners. STORE writes/reads raw bytes with no worker
     chain at all. */
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

export async function readArchive(input: Blob): Promise<BackupData> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(input);
  } catch {
    throw new BackupFormatError(NOT_A_BACKUP);
  }

  const manifestEntry = zip.file(MANIFEST);
  if (!manifestEntry) throw new BackupFormatError(NOT_A_BACKUP);

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(
      await manifestEntry.async("string"),
    ) as BackupManifest;
  } catch {
    throw new BackupFormatError(NOT_A_BACKUP);
  }

  if (typeof manifest.version !== "number" || !Array.isArray(manifest.books)) {
    throw new BackupFormatError(NOT_A_BACKUP);
  }
  if (!Array.isArray(manifest.groupings)) manifest.groupings = [];
  if (!Array.isArray(manifest.groupingMembers)) manifest.groupingMembers = [];
  if (manifest.version > BACKUP_VERSION) {
    throw new BackupFormatError(
      "This backup was made by a newer version of Librune — update the app and try again.",
    );
  }

  const files = new Map<string, Blob>();
  const covers = new Map<string, Blob>();

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (path.startsWith(BOOKS_DIR) && path.endsWith(EPUB_EXT)) {
      const bookId = path.slice(BOOKS_DIR.length, -EPUB_EXT.length);
      files.set(bookId, await entry.async("blob"));
    } else if (path.startsWith(COVERS_DIR)) {
      const bookId = path.slice(COVERS_DIR.length);
      if (bookId) covers.set(bookId, await entry.async("blob"));
    }
  }

  return { manifest, files, covers };
}
