import type { FC } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface ChipOption {
  value: string;
  label: string;
}

export type FilterSheetSection =
  | {
      type: "chips";
      key: string;
      label: string;
      options: ChipOption[];
      value: string;
      onChange: (value: string) => void;
    }
  | {
      type: "switch";
      key: string;
      label: string;
      checked: boolean;
      onChange: (checked: boolean) => void;
    }
  | {
      type: "select";
      key: string;
      label: string;
      value: string;
      options: ChipOption[];
      onChange: (value: string) => void;
    };

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  sections: FilterSheetSection[];
  onReset?: () => void;
  showReset?: boolean;
}

/**
 * One bottom sheet shape shared by every screen that lets the user sort
 * and/or filter a list — the book grid (Books tab, author screen), the
 * Shelves tab (sort + view mode only), and the series detail screen
 * (filters only, no sort — series order is fixed). Each caller passes the
 * `sections` it needs; this component only knows how to render three
 * section shapes (chip group, switch, select), never what any of them mean.
 */
export const FilterSheet: FC<FilterSheetProps> = ({
  open,
  onOpenChange,
  title,
  sections,
  onReset,
  showReset,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85dvh] flex-col rounded-t-3xl border-t bg-card p-0"
        showCloseButton={false}
      >
        <SheetHeader className="gap-4 border-b border-border px-6 pt-3 pb-5">
          <div className="mx-auto h-1 w-16 rounded-full bg-border" />
          <SheetTitle className="text-center">{title}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="flex flex-col gap-6 px-6 py-5">
            {sections.map((section) => {
              if (section.type === "chips") {
                return (
                  <div key={section.key} className="flex flex-col gap-2">
                    <p className="text-meta uppercase tracking-[0.08em] text-muted-foreground">
                      {section.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {section.options.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={
                            section.value === option.value
                              ? "secondary"
                              : "outline"
                          }
                          size="sm"
                          aria-pressed={section.value === option.value}
                          onClick={() => section.onChange(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              }

              if (section.type === "switch") {
                return (
                  <div
                    key={section.key}
                    className="flex items-center justify-between"
                  >
                    <label
                      htmlFor={`filter-sheet-${section.key}`}
                      className="text-meta uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      {section.label}
                    </label>
                    <Switch
                      id={`filter-sheet-${section.key}`}
                      checked={section.checked}
                      onCheckedChange={section.onChange}
                    />
                  </div>
                );
              }

              return (
                <div key={section.key} className="flex flex-col gap-2">
                  <label
                    htmlFor={`filter-sheet-${section.key}`}
                    className="text-meta uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    {section.label}
                  </label>
                  <select
                    id={`filter-sheet-${section.key}`}
                    className="input-folio text-ui text-foreground py-2"
                    value={section.value}
                    onChange={(e) => section.onChange(e.target.value)}
                  >
                    {section.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}

            {showReset && onReset && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={onReset}
              >
                Clear filters
              </Button>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
