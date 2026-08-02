/**
 * Raw OPFS (Origin Private File System) access for EPUB file blobs. Feature-
 * detected at every call — `getDirectory()` is broadly supported, but
 * `FileSystemFileHandle.createWritable()` is not (notably Safari outside
 * workers), so every function fails soft to `null`/`false` rather than
 * throwing, letting the caller fall back to IndexedDB.
 */

async function getEpubDir(): Promise<FileSystemDirectoryHandle | null> {
  if (!navigator.storage?.getDirectory) {
    return null;
  }

  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle("epub-files", { create: true });
}

export async function writeOpfsFile(
  bookId: string,
  file: Blob,
): Promise<boolean> {
  try {
    const dir = await getEpubDir();

    if (!dir) {
      return false;
    }

    const handle = await dir.getFileHandle(bookId, { create: true });

    if (!("createWritable" in handle)) {
      return false;
    }

    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();

    return true;
  } catch {
    return false;
  }
}

export async function readOpfsFile(bookId: string): Promise<Blob | null> {
  try {
    const dir = await getEpubDir();

    if (!dir) {
      return null;
    }

    const handle = await dir.getFileHandle(bookId);
    return await handle.getFile();
  } catch {
    return null;
  }
}

export async function deleteOpfsFile(bookId: string): Promise<void> {
  try {
    const dir = await getEpubDir();
    await dir?.removeEntry(bookId);
  } catch {
    // File was never migrated to OPFS, or already deleted — nothing to do.
  }
}
