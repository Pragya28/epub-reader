import { useState, type FC } from "react";
import { CaseSensitive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepperRow } from "@/components/ui/stepper-row";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_STEP,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_STEP,
  MARGIN_MAX,
  MARGIN_MIN,
  MARGIN_STEP,
  PARAGRAPH_SPACING_MAX,
  PARAGRAPH_SPACING_MIN,
  PARAGRAPH_SPACING_STEP,
  preferencesStore,
} from "@/features/preferences/store/preferences-store";
import { ThemeSelector } from "@/features/preferences/components/theme-selector";
import { FontSelector } from "@/features/preferences/components/font-selector";

interface ReaderToolbarProps {
  onOpenChange?: (open: boolean) => void;
}

export const ReaderToolbar: FC<ReaderToolbarProps> = ({ onOpenChange }) => {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const {
    fontScale,
    lineHeight,
    margins,
    paragraphSpacing,
    readerFont,
    readerTheme,
    applyThemeToReader,
    setFontScale,
    setLineHeight,
    setMargins,
    setParagraphSpacing,
    setReaderFont,
    setReaderTheme,
  } = preferencesStore();

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Reading preferences">
            <CaseSensitive className="size-5" strokeWidth={1.5} />
          </Button>
        }
      />
      {/* Fully transparent backdrop: the point of this sheet is previewing
          type changes, so the page behind it must stay legible. */}
      <SheetContent
        side="bottom"
        className="flex flex-col gap-6 overflow-y-auto rounded-t-3xl border-t bg-card p-0 pb-6 data-[side=bottom]:h-[40dvh]"
        overlayClassName="bg-transparent supports-backdrop-filter:backdrop-blur-none"
        showCloseButton={false}
      >
        <SheetHeader className="gap-4 border-b border-border px-6 pt-3 pb-5">
          <div className="mx-auto h-1 w-16 rounded-full bg-border" />

          <SheetTitle className="text-center">Reading Preferences</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-6">
          <StepperRow
            label="Font size"
            value={fontScale}
            format={{ style: "percent" }}
            min={FONT_SCALE_MIN}
            max={FONT_SCALE_MAX}
            step={FONT_SCALE_STEP}
            onChange={setFontScale}
          />

          <StepperRow
            label="Line height"
            value={lineHeight}
            format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
            min={LINE_HEIGHT_MIN}
            max={LINE_HEIGHT_MAX}
            step={LINE_HEIGHT_STEP}
            onChange={setLineHeight}
          />

          <StepperRow
            label="Margins"
            value={margins}
            suffix="px"
            min={MARGIN_MIN}
            max={MARGIN_MAX}
            step={MARGIN_STEP}
            onChange={setMargins}
          />

          <StepperRow
            label="Paragraph spacing"
            value={paragraphSpacing}
            suffix="px"
            min={PARAGRAPH_SPACING_MIN}
            max={PARAGRAPH_SPACING_MAX}
            step={PARAGRAPH_SPACING_STEP}
            onChange={setParagraphSpacing}
          />

          {/* Theme is a user-level (Settings) preference by default — only
              shown here when the user has opted the reader out of following
              it, per the "apply theme to reader" switch. */}
          {!applyThemeToReader && (
            <div className="flex items-center justify-between">
              <span className="metadata">Theme</span>
              <ThemeSelector value={readerTheme} onChange={setReaderTheme} />
            </div>
          )}

          <FontSelector
            value={readerFont}
            onChange={setReaderFont}
            showPreview={false}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
