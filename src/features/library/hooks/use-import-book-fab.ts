import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { importBook } from "../actions/import-book";
import { loadLibrary } from "../actions/load-library";
import { notify } from "@/components/toast/toast";
import { ROUTES } from "@/utils/routes";

/** Drives the hidden file-input flow behind the library's import FAB. */
export function useImportBookFab() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleImport = () => {
    const input = document.createElement("input");
    input.style.display = "none";
    input.setAttribute("type", "file");
    input.setAttribute("accept", "application/*");
    document.body.appendChild(input);

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      document.body.removeChild(input);

      if (!file) return;

      const isEpub =
        file.name.toLowerCase().endsWith(".epub") ||
        file.type === "application/epub+zip";

      if (!isEpub) {
        notify.error("Please select an EPUB file (.epub).");
        return;
      }

      setIsLoading(true);
      try {
        const { id } = await importBook(file);
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
        input.value = "";
      }
    });

    const event = new MouseEvent("click");
    input.dispatchEvent(event);
  };

  return { isLoading, handleImport };
}
