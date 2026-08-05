import { useEffect } from "react";
import { preferencesStore } from "../store/preferences-store";

/**
 * Toggles a "dark"/"light" class on <html> to match the user's explicit
 * theme choice. "system" removes both classes and lets the
 * `prefers-color-scheme` media query in index.css take over.
 */
export function useApplyTheme(): void {
  useEffect(() => {
    const apply = (theme: string) => {
      const root = document.documentElement;
      root.classList.remove("dark", "light");
      if (theme !== "system") root.classList.add(theme);
    };

    apply(preferencesStore.getState().theme);

    return preferencesStore.subscribe((state) => apply(state.theme));
  }, []);
}
