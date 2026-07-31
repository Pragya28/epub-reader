import type { FC } from "react";

import type { BookWithProgress } from "../../types/library.types";
import { getBookCoverVisual } from "@/shared/ornaments";

export const BookCover: FC<BookWithProgress> = ({
  id,
  coverBg,
  author,
  title,
}) => {
  const { palette, OrnamentComponent } = getBookCoverVisual(id);

  if (coverBg) {
    return (
      <div
        className="w-full h-full bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${coverBg})` }}
      />
    );
  }

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center gap-2 px-5 py-6 relative ${palette.gradient}`}
    >
      {/* Author */}
      {author && (
        <p
          className={`text-center tracking-[0.16em] leading-none z-10 text-[9px] ${palette.subColor}`}
        >
          {author}
        </p>
      )}
      {/* Ornament */}
      <OrnamentComponent
        className={`w-30 h-auto mx-auto my-2 ${palette.accent}`}
      />
      {/* Title */}
      <p
        className={`text-center wrap-break-word leading-[1.2] tracking-[0.06em] text-[15px] z-10 body-display ${palette.accent}`}
      >
        {title}
      </p>
    </div>
  );
};
