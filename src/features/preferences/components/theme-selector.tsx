import type { FC } from "react";
import { cn } from "@/utils/cn";
import type { AppTheme } from "../types/preferences.types";

interface ThemeSelectorProps {
  value: AppTheme;
  onChange: (value: AppTheme) => void;
}

const THEME_OPTIONS: { value: AppTheme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export const ThemeSelector: FC<ThemeSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-sm border border-border bg-background p-1">
      {THEME_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-sm py-1.5 text-ui-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-secondary text-secondary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
