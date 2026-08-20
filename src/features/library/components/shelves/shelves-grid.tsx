import { useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Layers, LibraryBig, Plus } from "lucide-react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { CardGrid } from "@/components/card-grid/card-grid";
import { ROUTES } from "@/utils/routes";
import { useShelvesScreen } from "../../hooks/use-shelves-screen";
import { createCollection } from "../../actions/collections";
import { CollectionNameSheet } from "../collections/collection-name-sheet";
import { GroupingCard } from "./grouping-card";
import type { GroupingWithMeta } from "../../utils/sort-groupings";

function Grid({ items }: { items: GroupingWithMeta[] }) {
  return (
    <CardGrid
      items={items}
      getKey={(item) => item.grouping.id}
      renderItem={(item) => <GroupingCard item={item} />}
    />
  );
}

export const ShelvesGrid: FC = () => {
  const { isLoading, isEmpty, viewMode, merged, series, collections, reload } =
    useShelvesScreen();
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  const createAndOpen = async (name: string) => {
    const id = await createCollection(name);
    reload();
    navigate(ROUTES.LIBRARY_COLLECTION.replace(":groupingId", id));
  };

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center py-24 text-ui text-muted-foreground"
      >
        Loading your shelves…
      </div>
    );
  }

  const newCollectionButton = (
    <Button variant="outline" onClick={() => setCreateOpen(true)}>
      <Plus strokeWidth={1.5} className="size-4" />
      New Collection
    </Button>
  );

  if (isEmpty) {
    return (
      <>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LibraryBig />
            </EmptyMedia>
            <EmptyTitle>No shelves yet</EmptyTitle>
            <EmptyDescription>
              Series are detected automatically from a book's metadata as you
              import more of them. Or start your own collection.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{newCollectionButton}</EmptyContent>
        </Empty>
        <CollectionNameSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={createAndOpen}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-4 text-ui-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Layers strokeWidth={1.5} className="size-4" /> Series
          </span>
          <span className="flex items-center gap-1.5">
            <Bookmark strokeWidth={1.5} className="size-4" /> Collections
          </span>
        </p>
        {newCollectionButton}
      </div>

      {viewMode === "merged" ? (
        <Grid items={merged} />
      ) : (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h2 className="text-ui font-semibold text-foreground">Series</h2>
            <Grid items={series} />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-ui font-semibold text-foreground">
              Collections
            </h2>
            <Grid items={collections} />
          </div>
        </div>
      )}

      <CollectionNameSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={createAndOpen}
      />
    </div>
  );
};
