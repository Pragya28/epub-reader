import type { FC } from "react";
import { useState } from "react";
import { importBook } from "../actions/import-book";
import { loadLibrary } from "../actions/load-library";
import { PlusIcon, SpinnerIcon } from "@/assets/icons";

export const ImportBookButton: FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = () => {
    const input = document.createElement("input");
    input.style.display = "none";
    input.setAttribute("type", "file");
    input.setAttribute("accept", "*/*");
    document.body.appendChild(input);

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      document.body.removeChild(input);

      if (!file) return;

      setError(null);

      const isEpub =
        file.name.toLowerCase().endsWith(".epub") ||
        file.type === "application/epub+zip";

      if (!isEpub) {
        setError("Please select an EPUB file (.epub).");
        return;
      }

      setIsLoading(true);
      try {
        await importBook(file);
        await loadLibrary();
      } catch (err) {
        console.error(err);
        setError("Failed to import book. Please try again.");
      } finally {
        setIsLoading(false);
      }
    });

    const event = new MouseEvent("click");
    input.dispatchEvent(event);
  };

  return (
    <>
      {error && (
        <div
          role="alert"
          onClick={() => setError(null)}
          className={[
            "fixed bottom-20 right-2 left-2 z-50",
            "px-4 py-3 rounded-xl text-sm text-center",
            "bg-(--cover-dark) text-(--color-error)",
            "shadow-(--shadow-floating) cursor-pointer",
          ].join(" ")}
        >
          {error}
        </div>
      )}

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
        {isLoading ? <SpinnerIcon /> : <PlusIcon />}
      </button>
    </>
  );
};
