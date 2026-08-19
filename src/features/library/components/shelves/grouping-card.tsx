import type { FC } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Layers } from "lucide-react";

import { ROUTES } from "@/utils/routes";
import { getBookCoverVisual } from "@/shared/ornaments";
import type {
  GroupingCoverSlot,
  GroupingWithMeta,
} from "../../utils/sort-groupings";

interface GroupingCardProps {
  item: GroupingWithMeta;
}

// One large cover (real, when available) plus two smaller stacked covers.
// Real covers fill these slots first (see buildGroupingsWithMeta), so a
// slot without one still belongs to a real member book — that book's own
// derived gradient (same one BookCover shows) fills it instead of a plain
// placeholder. Only a slot with no book behind it at all (fewer members
// than slots) falls back to the generic grey gradient.
function CoverSlot({ slot }: { slot?: GroupingCoverSlot }) {
  if (slot?.coverUrl) {
    return (
      <img
        src={slot.coverUrl}
        alt=""
        loading="lazy"
        className="size-full object-cover"
      />
    );
  }

  if (slot) {
    const { palette } = getBookCoverVisual(slot.bookId);
    return <div className={`size-full ${palette.gradient}`} />;
  }

  return (
    <div className="size-full bg-gradient-to-br from-muted to-border/60" />
  );
}

export const GroupingCard: FC<GroupingCardProps> = ({ item }) => {
  const { grouping, memberBookIds, coverSlots } = item;
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
            <CoverSlot slot={coverSlots[0]} />
          </div>
          <CoverSlot slot={coverSlots[1]} />
          <CoverSlot slot={coverSlots[2]} />
        </div>
      </div>

      <div className="flex items-start gap-1.5">
        <Icon
          strokeWidth={1.5}
          className="size-4 shrink-0 text-muted-foreground"
        />
        <div className="flex flex-col gap-0.5">
          <p className="font-bold text-ui leading-tight text-foreground line-clamp-2">
            {grouping.name}
          </p>
          <p className="text-ui-sm text-muted-foreground">
            {memberBookIds.length}{" "}
            {memberBookIds.length === 1 ? "book" : "books"}
          </p>
        </div>
      </div>
    </Link>
  );
};
