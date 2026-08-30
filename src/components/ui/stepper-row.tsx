import { NumberField } from "@base-ui/react/number-field";
import { MinusIcon, PlusIcon } from "@phosphor-icons/react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/utils/cn";

interface StepperRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Passed to Base UI's number formatter for the displayed value (e.g. `{ style: "percent" }`). */
  format?: Intl.NumberFormatOptions;
  /** Static unit text shown after the value, for cases `format` can't express (e.g. "px"). */
  suffix?: string;
  /** Dims and freezes the row — used when a parent toggle disables the setting. */
  disabled?: boolean;
  className?: string;
}

function StepperRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  suffix,
  disabled,
  className,
}: StepperRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between transition-opacity",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      <span className="metadata">{label}</span>
      <NumberField.Root
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        format={format}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
        aria-label={label}
      >
        <NumberField.Group className="flex items-center gap-3">
          <NumberField.Decrement
            aria-label={`Decrease ${label.toLowerCase()}`}
            className={buttonVariants({ variant: "outline", size: "icon-sm" })}
          >
            <MinusIcon className="size-3.5" weight="light" />
          </NumberField.Decrement>

          <span className="flex items-center justify-center gap-1 whitespace-nowrap">
            {/* Base UI also renders a visually-hidden native <input type="number">
                for form/validation purposes — this data-testid disambiguates
                the visible formatted field from that shadow input in tests. */}
            {/* readOnly + tabIndex -1: the value changes only via the
                +/- buttons — no keyboard entry, no pointer scrub-drag. */}
            {/* w-[4ch]: fits the widest value ("100%") with tabular-nums so
                every row's +/- buttons line up; the suffix sits outside it. */}
            <NumberField.Input
              readOnly
              tabIndex={-1}
              data-testid={`stepper-input-${label}`}
              className="w-[4ch] bg-transparent text-center text-ui tabular-nums outline-none"
            />
            {suffix && (
              <span className="text-ui text-muted-foreground">{suffix}</span>
            )}
          </span>

          <NumberField.Increment
            aria-label={`Increase ${label.toLowerCase()}`}
            className={buttonVariants({ variant: "outline", size: "icon-sm" })}
          >
            <PlusIcon className="size-3.5" weight="light" />
          </NumberField.Increment>
        </NumberField.Group>
      </NumberField.Root>
    </div>
  );
}

export { StepperRow };
