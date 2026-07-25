import type { FC } from "react";
import { useState } from "react";
import { importBook } from "../actions/import-book";
import { loadLibrary } from "../actions/load-library";
import { toastStore } from "@/stores/toast-store";

import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
export const ImportBookButton: FC = () => {
  const [isLoading, setIsLoading] = useState(false);

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
        toastStore.getState().showError("Please select an EPUB file (.epub).");
        return;
      }

      setIsLoading(true);
      try {
        await importBook(file);
        await loadLibrary();
        toastStore.getState().showSuccess("Book imported successfully");
      } catch (err) {
        const error =
          err instanceof Error
            ? `Couldn't import "${file.name}": ${err.message}`
            : `Couldn't import "${file.name}". The file may not be a valid EPUB.`;
        toastStore.getState().showError(error);
      } finally {
        setIsLoading(false);
        input.value = "";
      }
    });

    const event = new MouseEvent("click");
    input.dispatchEvent(event);
  };

  return (
    <button
      onClick={handleImport}
      disabled={isLoading}
      aria-label="Import book"
      className={[
        "fixed bottom-5 right-2 w-12 h-12 rounded-2xl",
        "flex items-center justify-center z-40",
        "border-none cursor-pointer",
        "transition-transform duration-100 active:scale-95",
        "bg-(--cover-dark) text-(--cover-gold) shadow-(--shadow-floating)",
        isLoading ? "opacity-60 pointer-events-none" : "hover:opacity-90",
      ].join(" ")}
    >
      {isLoading ? <Loader2 className="animate-spin" /> : <Plus />}
    </button>
  );
};
