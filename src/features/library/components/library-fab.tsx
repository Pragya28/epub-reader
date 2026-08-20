import { useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { Files, Loader2, Plus, X } from "lucide-react";
import { Bookmark, UploadSimple } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/utils/routes";
import { useImportBookFab } from "../hooks/use-import-book-fab";
import { createCollection } from "../actions/collections";
import { CollectionNameSheet } from "./collections/collection-name-sheet";

interface FabAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  /** Fan-out offset from the main FAB, closest action first. */
  offset: { bottom: number; right: number };
}

/**
 * The library's single creation entry point — a speed-dial FAB fanning
 * three actions out in an arc (Import Book / Import Multiple / Create
 * Collection) instead of scattering them across separate buttons per tab.
 * Hand-built with Tailwind transitions rather than an animation library —
 * matches how sheet.tsx already does entrance/exit, and the app has no
 * other speed-dial to reuse a pattern from.
 */
export const LibraryFab: FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { isLoading, handleImportOne, handleImportMany } = useImportBookFab();
  const navigate = useNavigate();

  const run = (action: () => void) => {
    setExpanded(false);
    action();
  };

  const createAndOpen = async (name: string) => {
    const id = await createCollection(name);
    navigate(ROUTES.LIBRARY_COLLECTION.replace(":groupingId", id));
  };

  const actions: FabAction[] = [
    {
      id: "import-book",
      label: "Import Book",
      icon: <UploadSimple className="size-5" />,
      onClick: () => run(() => void handleImportOne()),
      offset: { bottom: 96, right: 12 },
    },
    {
      id: "import-multiple",
      label: "Import Multiple",
      icon: <Files className="size-5" />,
      onClick: () => run(() => void handleImportMany()),
      offset: { bottom: 160, right: 56 },
    },
    {
      id: "create-collection",
      label: "Create Collection",
      icon: <Bookmark className="size-5" />,
      onClick: () => run(() => setCreateOpen(true)),
      offset: { bottom: 192, right: 128 },
    },
  ];

  return (
    <>
      {expanded && (
        <button
          type="button"
          aria-label="Close"
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-150"
        />
      )}

      {expanded &&
        actions.map((action) => (
          <div
            key={action.id}
            style={{ bottom: action.offset.bottom, right: action.offset.right }}
            className="fixed z-50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <span className="rounded-md border border-border bg-card px-3 py-1.5 text-ui-sm font-medium text-card-foreground shadow-soft whitespace-nowrap">
              {action.label}
            </span>
            <Button
              onClick={action.onClick}
              aria-label={action.label}
              size="icon"
              className="size-12 rounded-full bg-primary text-primary-foreground shadow-floating hover:bg-primary/90"
            >
              {action.icon}
            </Button>
          </div>
        ))}

      <Button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        disabled={isLoading}
        aria-label={expanded ? "Close" : "Add to library"}
        aria-expanded={expanded}
        className="
          fixed bottom-5 right-2 z-50
          size-16
          rounded-2xl
          bg-warm-accent
          hover:bg-warm-accent
          text-warm-accent-foreground
          shadow-floating
          opacity-90
          hover:opacity-100
          disabled:opacity-60
          transition-transform duration-150
        "
      >
        {isLoading ? (
          <Loader2 className="animate-spin size-8" />
        ) : expanded ? (
          <X className="size-8" />
        ) : (
          <Plus className="size-8" />
        )}
      </Button>

      <CollectionNameSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={createAndOpen}
      />
    </>
  );
};
