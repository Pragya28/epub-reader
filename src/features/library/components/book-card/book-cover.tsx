import type { FC } from "react";

import type { BookWithProgress } from "../../types/library.types";
import { hashString } from "@/shared/utils/hash";

const COVER_PALETTES: {
  gradient: string;
  accent: string;
  subColor: string;
}[] = [
  {
    gradient: "bg-linear-150 from-[#0E2E2A] to-[#071a12]",
    accent: "text-[#D4B483]",
    subColor: "text-[rgba(212,180,131,0.55)]",
  },
  {
    gradient: "bg-linear-160 from-[#1A1815] to-[#0a0906]",
    accent: "text-[#A67C52]",
    subColor: "text-[rgba(166,124,82,0.55)]",
  },
  {
    gradient: "bg-linear-145 from-[#EBE4D5] to-[#d8cdb8]",
    accent: "text-[#3a2a14]",
    subColor: "text-[rgba(58,42,20,0.5)]",
  },
  {
    gradient: "bg-linear-155 from-[#14293D] to-[#0a1824]",
    accent: "text-[#A67C52]",
    subColor: "text-[rgba(166,124,82,0.55)]",
  },
  {
    gradient: "bg-linear-160 from-[#3a0d2b] to-[#1a0a1f]",
    accent: "text-[#e8b4a0]",
    subColor: "text-[rgba(232,180,160,0.5)]",
  },
  {
    gradient: "bg-linear-140 from-[#c47a4a] to-[#7a3a1a]",
    accent: "text-[#f5e6c8]",
    subColor: "text-[rgba(245,230,200,0.6)]",
  },
  {
    gradient: "bg-linear-155 from-[#1e2a5e] to-[#0d1230]",
    accent: "text-[#7eb8f7]",
    subColor: "text-[rgba(126,184,247,0.5)]",
  },
  {
    gradient: "bg-linear-145 from-[#3a5a2a] to-[#1a2a0d]",
    accent: "text-[#d4e8a0]",
    subColor: "text-[rgba(212,232,160,0.5)]",
  },
  {
    gradient: "bg-linear-160 from-[#2e2a24] to-[#131210]",
    accent: "text-[#cbb27a]",
    subColor: "text-[rgba(203,178,122,0.55)]",
  },
  {
    gradient: "bg-linear-140 from-[#1a3a7a] to-[#0a1a3a]",
    accent: "text-[#f0d070]",
    subColor: "text-[rgba(240,208,112,0.5)]",
  },
  {
    gradient: "bg-linear-145 from-[#1a5a3a] to-[#0a2a1a]",
    accent: "text-[#a0f0c0]",
    subColor: "text-[rgba(160,240,192,0.45)]",
  },
  {
    gradient: "bg-linear-155 from-[#4a1a6a] to-[#1a0a2a]",
    accent: "text-[#d8b0f8]",
    subColor: "text-[rgba(216,176,248,0.5)]",
  },
];

export const BookCover: FC<BookWithProgress> = ({
  id,
  coverBg,
  author,
  title,
}) => {
  const palette = COVER_PALETTES[hashString(id) % COVER_PALETTES.length];

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
      {/* Title */}
      <p
        className={`text-center wrap-break-word leading-[1.2] tracking-[0.06em] text-[15px] z-10 body-display ${palette.accent}`}
      >
        {title}
      </p>
    </div>
  );
};
