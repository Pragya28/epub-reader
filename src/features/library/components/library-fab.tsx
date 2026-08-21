import type { FC } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Files, Loader2, Plus, X } from "lucide-react";
import { Bookmark, UploadSimple } from "@phosphor-icons/react";

import {
  ArcFabGroup,
  type ArcFabAction,
} from "@/components/arc-fab-group/arc-fab-group";
import { ROUTES } from "@/utils/routes";
import { useImportBookFab } from "../hooks/use-import-book-fab";
import { createCollection } from "../actions/collections";
import { CollectionNameSheet } from "./collections/collection-name-sheet";

/**
 * The library's single creation entry point — a speed-dial FAB fanning
 * three actions out in an arc (Import Book / Import Multiple / Create
 * Collection) instead of scattering them across separate buttons per tab.
 */
export const LibraryFab: FC = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const { isLoading, handleImportOne, handleImportMany } = useImportBookFab();
  const navigate = useNavigate();

  const createAndOpen = async (name: string) => {
    const id = await createCollection(name);
    navigate(ROUTES.LIBRARY_COLLECTION.replace(":groupingId", id));
  };

  const actions: ArcFabAction[] = [
    {
      id: "import-book",
      label: "Import Book",
      icon: <UploadSimple className="size-5" />,
      onClick: () => void handleImportOne(),
    },
    {
      id: "import-multiple",
      label: "Import Multiple",
      icon: <Files className="size-5" />,
      onClick: () => void handleImportMany(),
    },
    {
      id: "create-collection",
      label: "Create Collection",
      icon: <Bookmark className="size-5" />,
      onClick: () => setCreateOpen(true),
    },
  ];

  return (
    <>
      <ArcFabGroup
        className="fixed bottom-5 right-2"
        mainButtonSize={56}
        buttonSize={44}
        actions={actions}
        icon={
          isLoading ? (
            <Loader2 className="animate-spin size-7" />
          ) : (
            <Plus className="size-7" />
          )
        }
        activeIcon={<X className="size-7" />}
        ariaLabel="Add to library"
        disabled={isLoading}
        mainButtonClassName="bg-warm-accent hover:bg-warm-accent text-warm-accent-foreground"
      />

      <CollectionNameSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={createAndOpen}
      />
    </>
  );
};
