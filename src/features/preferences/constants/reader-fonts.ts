import type { ReaderFontId } from "../types/preferences.types";

export interface ReaderFontOption {
  id: ReaderFontId;
  label: string;
  /** Mirrored into the reader iframe's --reading-font-family custom property. */
  cssFontFamily: string;
}

// All four are self-hosted under public/fonts/ (see each folder's README) —
// offline-safe on the very first read, same reasoning as Literata's existing
// self-hosting note in iframe-renderer.ts. Deliberately not the app's own
// Cinzel/Jakarta brand fonts: these are chosen for reading, not identity.
export const READER_FONTS: ReaderFontOption[] = [
  { id: "literata", label: "Literata", cssFontFamily: `"Literata", serif` },
  { id: "lora", label: "Lora", cssFontFamily: `"Lora", serif` },
  { id: "dmsans", label: "DM Sans", cssFontFamily: `"DM Sans", sans-serif` },
  {
    id: "atkinson",
    label: "Atkinson Hyperlegible",
    cssFontFamily: `"Atkinson Hyperlegible", sans-serif`,
  },
];

export function getReaderFont(id: ReaderFontId): ReaderFontOption {
  return READER_FONTS.find((font) => font.id === id) ?? READER_FONTS[0];
}
