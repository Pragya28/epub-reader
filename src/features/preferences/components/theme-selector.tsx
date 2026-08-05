import type { FC } from "react";
import { Button } from "@/components/ui/button";
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
    <div className="flex gap-1">
      {THEME_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "secondary" : "outline"}
          size="sm"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
};
