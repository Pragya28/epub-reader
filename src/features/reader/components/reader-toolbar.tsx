import { useState, type FC } from "react";
import { Minus, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  readerPreferencesStore,
  type ReaderTheme,
} from "../store/reader-preferences-store";

const THEME_OPTIONS: { value: ReaderTheme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export const ReaderToolbar: FC = () => {
  const [open, setOpen] = useState(false);
  const {
    fontScale,
    lineHeight,
    theme,
    setFontScale,
    setLineHeight,
    setTheme,
  } = readerPreferencesStore();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Reading preferences">
            <SlidersHorizontal className="size-5" strokeWidth={1.5} />
          </Button>
        }
      />
      <SheetContent
        side="bottom"
        className="flex max-h-[85dvh] flex-col gap-6 rounded-t-3xl border-t bg-card p-0 pb-6"
        showCloseButton={false}
      >
        <SheetHeader className="border-b border-border px-6 pt-3 pb-5">
          <div className="mx-auto mb-4 h-1 w-16 rounded-full bg-border" />

          <SheetTitle className="font-heading text-base font-semibold tracking-[0.18em] text-center">
            Reading Preferences
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-6">
          <div className="flex items-center justify-between">
            <span className="metadata">Font size</span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Decrease font size"
                disabled={fontScale <= FONT_SCALE_MIN}
                onClick={() => setFontScale(fontScale - FONT_SCALE_STEP)}
              >
                <Minus className="size-3.5" strokeWidth={1.5} />
              </Button>
              <span className="w-10 text-center text-sm tabular-nums">
                {Math.round(fontScale * 100)}%
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Increase font size"
                disabled={fontScale >= FONT_SCALE_MAX}
                onClick={() => setFontScale(fontScale + FONT_SCALE_STEP)}
              >
                <Plus className="size-3.5" strokeWidth={1.5} />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="metadata">Line height</span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Decrease line height"
                disabled={lineHeight <= LINE_HEIGHT_MIN}
                onClick={() => setLineHeight(lineHeight - LINE_HEIGHT_STEP)}
              >
                <Minus className="size-3.5" strokeWidth={1.5} />
              </Button>
              <span className="w-10 text-center text-sm tabular-nums">
                {lineHeight.toFixed(1)}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Increase line height"
                disabled={lineHeight >= LINE_HEIGHT_MAX}
                onClick={() => setLineHeight(lineHeight + LINE_HEIGHT_STEP)}
              >
                <Plus className="size-3.5" strokeWidth={1.5} />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="metadata">Theme</span>
            <div className="flex gap-1">
              {THEME_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={theme === option.value ? "secondary" : "outline"}
                  size="sm"
                  aria-pressed={theme === option.value}
                  onClick={() => setTheme(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
