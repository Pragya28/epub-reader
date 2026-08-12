import type { FC } from "react";

import { getBookCoverVisual } from "@/shared/ornaments";

interface BookCoverProps {
  /** Drives the derived gradient + ornament — same book, same cover, always. */
  id: string;
  title: string;
  author?: string;
  /** Object URL for the EPUB's own cover image, when it has one. */
  coverUrl?: string;
  /** Smaller type for list rows; the library grid uses the default. */
  compact?: boolean;
}

/**
 * A book's cover: the EPUB's own image when it has one, otherwise a gradient
 * derived from the book id. The gradient is deliberately *not* persisted —
 * it's a pure function of the id, so it survives reinstall, re-import and
 * index rebuilds without a schema field or a migration. Store a cover style
 * only if the user ever gets to choose one.
 *
 * Real cover art is `object-contain`, never `object-cover`: publisher covers
 * vary in aspect ratio, and cropping them to a uniform box cuts off titles.
 */
export const BookCover: FC<BookCoverProps> = ({
  id,
  title,
  author,
  coverUrl,
  compact = false,
}) => {
  const { palette, OrnamentComponent } = getBookCoverVisual(id);

  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-full object-contain bg-muted"
      />
    );
  }

  return (
    <div
      className={`size-full flex flex-col items-center justify-center relative ${
        compact ? "gap-1 px-1.5 py-2" : "gap-2 px-5 py-6"
      } ${palette.gradient}`}
    >
      {author && !compact && (
        <p
          className={`text-center tracking-[0.16em] leading-none z-10 text-meta ${palette.subColor}`}
        >
          {author}
        </p>
      )}

      {/* At thumbnail size the ornament renders as an illegible smudge, so
          the compact variant leans on the title's initial instead — still
          derived, still distinct per book, but readable at 56px. */}
      {compact ? (
        <span
          className={`body-display text-title-sm leading-none ${palette.accent}`}
        >
          {title.trim().charAt(0).toUpperCase()}
        </span>
      ) : (
        <OrnamentComponent
          className={`h-auto mx-auto w-30 my-2 ${palette.accent}`}
        />
      )}

      {!compact && (
        <p
          className={`text-center wrap-break-word leading-[1.2] tracking-[0.06em] text-title-sm z-10 body-display ${palette.accent}`}
        >
          {title}
        </p>
      )}
    </div>
  );
};
