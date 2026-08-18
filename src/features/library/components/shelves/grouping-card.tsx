import type { FC } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Layers } from "lucide-react";

import { ROUTES } from "@/utils/routes";
import type { GroupingWithMeta } from "../../utils/sort-groupings";

interface GroupingCardProps {
  item: GroupingWithMeta;
}

// One large cover (real, when available) plus two smaller stacked covers —
// real covers always fill these slots first (covers[] only ever holds real
// URLs), so a grey gradient only ever appears for a slot with no real book
// behind it, never in place of one that has one.
function CoverSlot({ url }: { url?: string }) {
  if (url) {
    return (
      <img src={url} alt="" loading="lazy" className="size-full object-cover" />
    );
  }

  return (
    <div className="size-full bg-gradient-to-br from-muted to-border/60" />
  );
}

export const GroupingCard: FC<GroupingCardProps> = ({ item }) => {
  const { grouping, memberBookIds, covers } = item;
  const Icon = grouping.type === "series" ? Layers : Bookmark;
  const href =
    grouping.type === "series"
      ? ROUTES.LIBRARY_SERIES.replace(":groupingId", grouping.id)
      : ROUTES.LIBRARY_COLLECTION.replace(":groupingId", grouping.id);

  return (
    <Link
      to={href}
      className="group flex flex-col gap-2 rounded-xl focus-visible:ring-2 focus-visible:ring-ring outline-none"
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-xl border border-border/40 elevated-soft transition-shadow group-hover:shadow-lg">
        <div className="grid size-full grid-cols-[2fr_1fr] grid-rows-2 gap-0.5">
          <div className="row-span-2">
            <CoverSlot url={covers[0]} />
          </div>
          <CoverSlot url={covers[1]} />
          <CoverSlot url={covers[2]} />
        </div>
        <div className="absolute top-0 right-0 flex items-center justify-center rounded-bl-xl bg-background/95 p-1.5">
          <Icon strokeWidth={1.5} className="size-4 text-foreground" />
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="font-bold text-ui leading-tight text-foreground line-clamp-2">
          {grouping.name}
        </p>
        <p className="text-ui-sm text-muted-foreground">
          {memberBookIds.length} {memberBookIds.length === 1 ? "book" : "books"}
        </p>
      </div>
    </Link>
  );
};
