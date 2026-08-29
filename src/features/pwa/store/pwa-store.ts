import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Small persisted flags that gate one-time PWA prompts. localStorage-backed
 * (same pattern as preferences-store / search-maintenance-store) — these are
 * per-device UI state, not library data.
 */
interface PwaStore {
  /** Set true after the user's first successful import (or on load if they
   * already have books). Gates the install banner — don't solicit an install
   * before the user has any investment in their library. */
  firstImportDone: boolean;
  /** `navigator.storage.persist()` has been asked once — don't re-prompt. */
  persistRequested: boolean;
  /** User dismissed the install banner — never show it again. */
  installDismissed: boolean;
  /** The library had ≥1 book at some point. If it's now empty, that's
   * browser eviction, not a new user. */
  hadBooks: boolean;

  setFirstImportDone: (value: boolean) => void;
  setPersistRequested: (value: boolean) => void;
  setInstallDismissed: (value: boolean) => void;
  setHadBooks: (value: boolean) => void;
}

export const pwaStore = create<PwaStore>()(
  persist(
    (set) => ({
      firstImportDone: false,
      persistRequested: false,
      installDismissed: false,
      hadBooks: false,

      setFirstImportDone: (value) => set({ firstImportDone: value }),
      setPersistRequested: (value) => set({ persistRequested: value }),
      setInstallDismissed: (value) => set({ installDismissed: value }),
      setHadBooks: (value) => set({ hadBooks: value }),
    }),
    { name: "librune-pwa" },
  ),
);
