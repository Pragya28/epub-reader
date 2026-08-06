import type { ComponentProps } from "react";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { cn } from "@/utils/cn";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid w-full gap-2", className)}
      {...props}
    />
  );
}

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "group/radio-group-item peer relative flex aspect-square size-4 shrink-0 rounded-full border border-input outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex size-4 items-center justify-center"
      >
        <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
}

/**
 * A full-row radio variant for "select one from a list of named rows"
 * layouts (e.g. the font-selector in features/preferences) — the whole
 * row is the selectable target with an inset ring + external indicator,
 * rather than RadioGroupItem's dot-plus-label pattern.
 */
function RadioGroupRow({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-row"
      className={cn(
        "flex cursor-pointer items-center justify-between px-4 py-4 text-left outline-none data-checked:bg-surface-high data-checked:ring-[1.5px] data-checked:ring-selected data-checked:ring-inset",
        className,
      )}
      {...props}
    />
  );
}

/** Bare indicator (no dot) for RadioGroupRow — pass your own checkmark/icon as children. */
function RadioGroupRowIndicator({
  className,
  ...props
}: ComponentProps<typeof RadioPrimitive.Indicator>) {
  return (
    <RadioPrimitive.Indicator
      data-slot="radio-group-row-indicator"
      keepMounted={false}
      className={cn("flex", className)}
      {...props}
    />
  );
}

export { RadioGroup, RadioGroupItem, RadioGroupRow, RadioGroupRowIndicator };
