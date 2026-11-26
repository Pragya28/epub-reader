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

// A book's spine, coloured like its own cover. Width and height vary a little
// per book (derived from its id, so they never shuffle) and the heights stay
// close, so a row reads as books on a shelf rather than a bar chart. The two
// foil bands near the ends are what make a bar look like a spine.
function Spine({ slot }: { slot: GroupingCoverSlot }) {
  const { palette } = getBookCoverVisual(slot.bookId);
  const seed = [...slot.bookId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const width = 20 + (seed % 3) * 5;
  const height = 84 + (seed % 3) * 8;

  return (
    <div
      style={{ width, height: `${height}%` }}
      className={`flex flex-none flex-col items-center rounded-t-[3px] shadow-[inset_-2px_0_0_rgb(0_0_0/0.18)] ${palette.gradient} ${palette.accent}`}
    >
      <span className="mt-2 h-0.5 w-3/4 shrink-0 rounded-full bg-current opacity-50" />
      <span className="my-2 min-h-0 flex-1 truncate text-meta tracking-wide [writing-mode:vertical-rl]">
        {slot.title}
      </span>
      <span className="mb-2 h-0.5 w-3/4 shrink-0 rounded-full bg-current opacity-50" />
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
        <div className="flex size-full flex-col bg-muted">
          <div className="flex flex-1 items-end justify-center gap-0.5 px-3 pt-8 shadow-[inset_0_10px_14px_-10px_rgb(0_0_0/0.3)]">
            {slots.slice(0, MAX_SPINES).map((slot) => (
              <Spine key={slot.bookId} slot={slot} />
            ))}
          </div>
          <div className="h-2 border-t border-foreground/20 bg-border shadow-[0_1px_0_rgb(0_0_0/0.15)]" />
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
