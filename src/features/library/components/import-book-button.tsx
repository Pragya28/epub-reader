import type { ChangeEvent, FC } from "react";
import { useRef, useState } from "react";
import { importBook } from "../actions/import-book";
import { loadLibrary } from "../actions/load-library";
import { PlusIcon, SpinnerIcon } from "@/assets/icons";

export const ImportBookButton: FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".epub"
        onChange={onImport}
        className="hidden"
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={isLoading}
        aria-label="Import book"
        // Fixed bottom-right, same height as the banner
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
