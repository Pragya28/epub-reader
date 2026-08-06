import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { useImportBookFab } from "../hooks/use-import-book-fab";

export const ImportBookFab: FC = () => {
  const { isLoading, handleImport } = useImportBookFab();

  return (
    <Button
      onClick={(e) => {
        e.stopPropagation();
        handleImport();
      }}
      disabled={isLoading}
      aria-label="Import book"
      className="
        fixed bottom-5 right-2
        size-16
        rounded-2xl
        bg-warm-accent
        hover:bg-warm-accent
        text-warm-accent-foreground
        shadow-floating
        opacity-90
        hover:opacity-100
        disabled:opacity-60
      "
    >
      {isLoading ? (
        <Loader2 className="animate-spin size-8" />
      ) : (
        <Plus className="size-8" />
      )}
    </Button>
  );
};
