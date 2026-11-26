import type { FC } from "react";
import { Link } from "react-router-dom";
import { BookmarkIcon, StackIcon } from "@phosphor-icons/react";

import { BookCover } from "@/components/book-cover/book-cover";
import { ROUTES } from "@/utils/routes";
import { getBookCoverVisual } from "@/shared/ornaments";
import type {
  GroupingCoverSlot,
  GroupingWithMeta,
} from "../../utils/sort-groupings";

interface GroupingCardProps {
  item: GroupingWithMeta;
}

type Layout = "empty" | "spines" | "single" | "pair" | "mosaic";

const MAX_SPINES = 5;

// The card art follows what the group actually has, so a group is never
// padded out with blank tiles: a mosaic only when there are real covers to
// show (coverless books alone would just be flat colour blocks), a shelf of
// spines when there are none, and the one real cover full-size when there is
// just one. Real covers sort first in coverSlots (see buildGroupingsWithMeta).
function pickLayout(slots: GroupingCoverSlot[]): Layout {
  if (slots.length === 0) return "empty";
  const real = slots.filter((slot) => slot.coverUrl).length;
  if (real === 0) return "spines";
  if (real === 1) return "single";
  return slots.length === 2 ? "pair" : "mosaic";
}

function CoverSlot({
  slot,
  size,
}: {
  slot: GroupingCoverSlot;
  size: "full" | "tile" | "compact";
}) {
  if (slot.coverUrl && size !== "full") {
    return (
      <img
        src={slot.coverUrl}
        alt=""
        loading="lazy"
        className="size-full object-cover"
      />
    );
  }

  return (
    <BookCover
      id={slot.bookId}
      title={slot.title}
      author={slot.author}
      coverUrl={slot.coverUrl}
      tile={size === "tile"}
      compact={size === "compact"}
    />
  );
}

// A book's spine, coloured and ordered like its own cover. Height varies a
// little per book (derived from its id, so it never shuffles) to read as a
// real shelf instead of a uniform bar chart.
function Spine({ slot }: { slot: GroupingCoverSlot }) {
  const { palette } = getBookCoverVisual(slot.bookId);
  const seed = [...slot.bookId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const height = 72 + (seed % 4) * 9;

  return (
    <div
      style={{ height: `${height}%` }}
      className={`flex max-w-8 min-w-0 flex-1 items-center justify-center rounded-t-sm py-2 ${palette.gradient}`}
    >
      <span
        className={`max-h-full truncate text-meta tracking-wide [writing-mode:vertical-rl] ${palette.accent}`}
      >
        {slot.title}
      </span>
    </div>
  );
}

function CardArt({
  layout,
  slots,
  Icon,
}: {
  layout: Layout;
  slots: GroupingCoverSlot[];
  Icon: typeof StackIcon;
}) {
  switch (layout) {
    case "empty":
      return (
        <div className="flex size-full items-center justify-center border border-dashed border-border bg-muted/50">
          <Icon weight="light" className="size-8 text-muted-foreground" />
        </div>
      );
    case "spines":
      return (
        <div className="flex size-full flex-col bg-card">
          <div className="flex flex-1 items-end justify-center gap-1 px-4 pt-5">
            {slots.slice(0, MAX_SPINES).map((slot) => (
              <Spine key={slot.bookId} slot={slot} />
            ))}
          </div>
          <div className="h-1.5 bg-border" />
        </div>
      );
    case "single":
      return <CoverSlot slot={slots[0]} size="full" />;
    case "pair":
      return (
        <div className="grid size-full grid-cols-2 gap-0.5">
          <CoverSlot slot={slots[0]} size="tile" />
          <CoverSlot slot={slots[1]} size="tile" />
        </div>
      );
    case "mosaic":
      return (
        <div className="grid size-full grid-cols-[2fr_1fr] grid-rows-2 gap-0.5">
          <div className="row-span-2">
            <CoverSlot slot={slots[0]} size="tile" />
          </div>
          <CoverSlot slot={slots[1]} size="compact" />
          <CoverSlot slot={slots[2]} size="compact" />
        </div>
      );
  }
}

export const GroupingCard: FC<GroupingCardProps> = ({ item }) => {
  const { grouping, memberBookIds, coverSlots } = item;
  const Icon = grouping.type === "series" ? StackIcon : BookmarkIcon;
  const href =
    grouping.type === "series"
      ? ROUTES.LIBRARY_SERIES.replace(":groupingId", grouping.id)
      : ROUTES.LIBRARY_COLLECTION.replace(":groupingId", grouping.id);
  const layout = pickLayout(coverSlots);

  return (
    <Link
      to={href}
      className="group flex flex-col gap-2 rounded-xl focus-visible:ring-2 focus-visible:ring-ring outline-none"
    >
      <div
        data-layout={layout}
        className="relative aspect-square overflow-hidden rounded-xl border border-border/40 elevated-soft transition-shadow group-hover:shadow-lg"
      >
        <CardArt layout={layout} slots={coverSlots} Icon={Icon} />
      </div>

      <div className="flex items-start gap-1.5">
        <Icon
          weight="light"
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
