import type { FC, CSSProperties } from "react";
import { Check } from "lucide-react";
import {
  RadioGroup,
  RadioGroupRow,
  RadioGroupRowIndicator,
} from "@/components/ui/radio-group";
import { READER_FONTS } from "../constants/reader-fonts";
import type { ReaderFontId } from "../types/preferences.types";

interface FontSelectorProps {
  value: ReaderFontId;
  onChange: (value: ReaderFontId) => void;
  /** Reflected in the preview so it matches how the reader will actually render. */
  fontScale?: number;
  lineHeight?: number;
  paragraphSpacing?: number;
}

const PREVIEW_PANGRAM = "A quick brown fox jumps over the lazy dog.";
const PREVIEW_ALPHABET = "ABCDEFGHIJKLM…abcdefghijklm…1234567890";

const PREVIEW_BASE_SIZE_LG = 20; // px, matches --text-reading-lg
const PREVIEW_BASE_SIZE_MD = 17; // px, matches --text-reading-md

export const FontSelector: FC<FontSelectorProps> = ({
  value,
  onChange,
  fontScale = 1,
  lineHeight = 1.6,
  paragraphSpacing = 8,
}) => {
  const selected =
    READER_FONTS.find((font) => font.id === value) ?? READER_FONTS[0];

  const pangramStyle: CSSProperties = {
    fontFamily: selected.cssFontFamily,
    fontSize: `${PREVIEW_BASE_SIZE_LG * fontScale}px`,
    lineHeight,
    marginBottom: `${paragraphSpacing}px`,
  };

  const alphabetStyle: CSSProperties = {
    fontFamily: selected.cssFontFamily,
    fontSize: `${PREVIEW_BASE_SIZE_MD * fontScale}px`,
    lineHeight,
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <span className="metadata pl-2">Select Typeface</span>

      <RadioGroup
        aria-label="Select Typeface"
        value={value}
        onValueChange={(next) => onChange(next as ReaderFontId)}
        className="flex flex-col rounded-sm bg-card overflow-hidden"
      >
        {READER_FONTS.map((font, index) => (
          <RadioGroupRow
            key={font.id}
            value={font.id}
            className={
              index !== READER_FONTS.length - 1
                ? "border-b border-border/40"
                : ""
            }
          >
            <span
              className="text-ui text-foreground"
              style={{ fontFamily: font.cssFontFamily }}
            >
              {font.label}
            </span>
            <RadioGroupRowIndicator>
              <Check className="size-4 text-foreground" strokeWidth={2} />
            </RadioGroupRowIndicator>
          </RadioGroupRow>
        ))}
      </RadioGroup>

      <div className="flex flex-col pt-4 w-full">
        <span className="metadata pl-2 mb-2">Preview</span>
        <div className="flex flex-col rounded-sm bg-surface-high p-8">
          <p className="text-foreground" style={pangramStyle}>
            {PREVIEW_PANGRAM}
          </p>
          <p className="text-muted-foreground opacity-70" style={alphabetStyle}>
            {PREVIEW_ALPHABET}
          </p>
        </div>
      </div>
    </div>
  );
};
