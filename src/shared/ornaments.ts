// src/features/library/utils/ornaments.ts

import orrerySvg from "@/assets/ornaments/orrery.svg?raw";
import illuminationSvg from "@/assets/ornaments/illumination.svg?raw";
import compassSvg from "@/assets/ornaments/compass.svg?raw";
import runeLineSvg from "@/assets/ornaments/rune-line.svg?raw";
import inkWashSvg from "@/assets/ornaments/ink-wash.svg?raw";
import alchemicalSvg from "@/assets/ornaments/alchemical.svg?raw";

import OrreryComponent from "@/assets/ornaments/orrery.svg?react";
import IlluminationComponent from "@/assets/ornaments/illumination.svg?react";
import CompassComponent from "@/assets/ornaments/compass.svg?react";
import RuneLineComponent from "@/assets/ornaments/rune-line.svg?react";
import InkWashComponent from "@/assets/ornaments/ink-wash.svg?react";
import AlchemicalComponent from "@/assets/ornaments/alchemical.svg?react";

export const ORNAMENT_IDS = [
  "orrery",
  "illumination",
  "compass",
  "rune-line",
  "ink-wash",
  "alchemical",
] as const;

export type OrnamentId = (typeof ORNAMENT_IDS)[number];

// Raw strings → iframe injection
export const ORNAMENT_SVG_STRINGS: Record<OrnamentId, string> = {
  orrery: orrerySvg,
  illumination: illuminationSvg,
  compass: compassSvg,
  "rune-line": runeLineSvg,
  "ink-wash": inkWashSvg,
  alchemical: alchemicalSvg,
};

// React components → cover rendering
export const ORNAMENT_COMPONENTS: Record<
  OrnamentId,
  React.FC<React.SVGProps<SVGSVGElement>>
> = {
  orrery: OrreryComponent,
  illumination: IlluminationComponent,
  compass: CompassComponent,
  "rune-line": RuneLineComponent,
  "ink-wash": InkWashComponent,
  alchemical: AlchemicalComponent,
};

export function deriveOrnamentId(bookId: string): OrnamentId {
  let hash = 0;
  for (let i = 0; i < bookId.length; i++) {
    hash = (hash * 31 + bookId.charCodeAt(i)) >>> 0;
  }
  return ORNAMENT_IDS[hash % ORNAMENT_IDS.length];
}
