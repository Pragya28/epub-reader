import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { importBook } from "../actions/import-book";
import { loadLibrary } from "../actions/load-library";
import { notify } from "@/components/toast/toast";
import { ROUTES } from "@/utils/routes";
import {
  hasRoomFor,
  requestPersistentStorage,
} from "@/services/storage/storage-quota";
import { pwaStore } from "@/features/pwa/store/pwa-store";

// ponytail: an import writes the raw epub, a cover, and (in the background) a
// search index that's a multiple of the book's text — 3× the file size is a
// rough headroom estimate. Tighten if real quota errors slip through.
const IMPORT_EXPANSION_FACTOR = 3;

function isEpub(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".epub") ||
    file.type === "application/epub+zip"
  );
}

/** Fire-and-forget: after the first successful import, mark the first-run
 * install gate cleared and ask once for persistent storage so the browser
 * won't evict the library under disk pressure. Never blocks or fails the
 * import. */
function onFirstImportSucceeded() {
  const store = pwaStore.getState();
  if (store.firstImportDone) return;
  store.setFirstImportDone(true);
  if (!store.persistRequested) {
    store.setPersistRequested(true);
    void requestPersistentStorage();
  }
}

function pickFiles(multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.style.display = "none";
    input.setAttribute("type", "file");
    input.setAttribute("accept", "application/*");
    if (multiple) input.setAttribute("multiple", "");
    document.body.appendChild(input);

    input.addEventListener("change", () => {
      const files = Array.from(input.files ?? []);
      document.body.removeChild(input);
      resolve(files);
    });

    input.dispatchEvent(new MouseEvent("click"));
  });
}

/** Drives the file-picking flows behind the library FAB's Import Book and
 * Import Multiple actions. */
export function useImportBookFab() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleImportOne = async () => {
    const [file] = await pickFiles(false);
    if (!file) return;

    if (!isEpub(file)) {
      notify.error("Please select an EPUB file (.epub).");
      return;
    }

    if (!(await hasRoomFor(file.size * IMPORT_EXPANSION_FACTOR))) {
      notify.error(`Not enough storage space to import "${file.name}".`);
      return;
    }

    setIsLoading(true);
    try {
      const { id } = await importBook(file);
      onFirstImportSucceeded();
      await loadLibrary();
      notify.success("Book imported successfully");
      navigate(ROUTES.READER.replace(":bookId", id));
    } catch (err) {
      const error =
        err instanceof Error
          ? `Couldn't import "${file.name}": ${err.message}`
          : `Couldn't import "${file.name}". The file may not be a valid EPUB.`;
      notify.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  /** Continues past individual failures — one bad file in a batch
   * shouldn't block the rest — then reports one summary toast rather than
   * one toast per file. */
  const handleImportMany = async () => {
    const files = await pickFiles(true);
    if (files.length === 0) return;

    setIsLoading(true);
    try {
      let succeeded = 0;
      const failed: string[] = [];

      for (const file of files) {
        if (!isEpub(file)) {
          failed.push(file.name);
          continue;
        }
        if (!(await hasRoomFor(file.size * IMPORT_EXPANSION_FACTOR))) {
          failed.push(file.name);
          continue;
        }
        try {
          await importBook(file);
          succeeded++;
        } catch {
          failed.push(file.name);
        }
      }

      if (succeeded > 0) onFirstImportSucceeded();

      await loadLibrary();

      if (succeeded > 0) {
        notify.success(
          failed.length === 0
            ? `Imported ${succeeded} ${succeeded === 1 ? "book" : "books"}`
            : `Imported ${succeeded} of ${files.length} books`,
        );
      }
      if (failed.length > 0) {
        notify.error(`Couldn't import: ${failed.join(", ")}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, handleImportOne, handleImportMany };
}
