import { useLayoutEffect } from "react";
import { preferencesStore } from "../store/preferences-store";

/**
 * Toggles a "dark"/"light" class on <html> to match the user's explicit
 * theme choice. "system" removes both classes and lets the
 * `prefers-color-scheme` media query in index.css take over.
 *
 * A blocking script in index.html applies the same class before first paint;
 * this keeps it in sync afterwards. Layout effect + a same-value guard so an
 * unrelated preference change doesn't churn the class list.
 */
export function useApplyTheme(): void {
  useLayoutEffect(() => {
    const apply = (theme: string) => {
      const root = document.documentElement;
      root.classList.remove("dark", "light");
      if (theme !== "system") root.classList.add(theme);
    };

    let current = preferencesStore.getState().theme;
    apply(current);

    return preferencesStore.subscribe((state) => {
      if (state.theme === current) return;
      current = state.theme;
      apply(current);
    });
  }, []);
}
