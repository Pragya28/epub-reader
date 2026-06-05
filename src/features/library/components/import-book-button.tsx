import type { ChangeEvent, FC } from "react";
import { useState } from "react";
import { importBook } from "../actions/import-book";
import { loadLibrary } from "../actions/load-library";
import { PlusIcon, SpinnerIcon } from "@/assets/icons";

export const ImportBookButton: FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isEpub = file.name.toLowerCase().endsWith(".epub");

    if (!isEpub) {
      console.warn("Not an EPUB file");
      return;
    }
    setIsLoading(true);
    try {
      await importBook(file);
      await loadLibrary();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      e.target.value = "";
    }
  };

  return (
    <div
      className={[
        "fixed bottom-5 right-2 w-12 h-12 rounded-2xl",
        "flex items-center justify-center z-40",
        "transition-transform duration-100 active:scale-95",
        "bg-(--cover-dark) text-(--cover-gold) shadow-(--shadow-floating)",
        isLoading ? "opacity-60 pointer-events-none" : "hover:opacity-90",
      ].join(" ")}
    >
      {isLoading ? <SpinnerIcon /> : <PlusIcon />}

      <input
        type="file"
        id="epubPicker"
        accept="application/epub+zip, .epub, application/zip"
        onChange={onImport}
        disabled={isLoading}
        aria-label="Import book"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
};
