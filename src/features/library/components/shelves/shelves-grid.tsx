import type { FC } from "react";
import { Bookmark, Layers, LibraryBig } from "lucide-react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useShelvesScreen } from "../../hooks/use-shelves-screen";
import { GroupingCard } from "./grouping-card";
import type { GroupingWithMeta } from "../../utils/sort-groupings";

function Grid({ items }: { items: GroupingWithMeta[] }) {
  return (
    <div
      className="grid gap-x-4 gap-y-5"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}
    >
      {items.map((item) => (
        <GroupingCard key={item.grouping.id} item={item} />
      ))}
    </div>
  );
}

export const ShelvesGrid: FC = () => {
  const { isLoading, isEmpty, viewMode, merged, series, collections } =
    useShelvesScreen();

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

  if (isEmpty) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LibraryBig />
          </EmptyMedia>
          <EmptyTitle>No shelves yet</EmptyTitle>
          <EmptyDescription>
            Series are detected automatically from a book's metadata as you
            import more of them.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent />
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="flex items-center gap-4 text-ui-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Layers strokeWidth={1.5} className="size-4" /> Series
        </span>
        <span className="flex items-center gap-1.5">
          <Bookmark strokeWidth={1.5} className="size-4" /> Collections
        </span>
      </p>

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
    </div>
  );
};
