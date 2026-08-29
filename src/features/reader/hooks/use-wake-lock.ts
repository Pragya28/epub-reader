import { useCallback, useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { preferencesStore } from "@/features/preferences/store/preferences-store";

/**
 * Holds the screen on while reading (Screen Wake Lock API), consumed by the
 * reader screen only.
 *
 * Feature-detected and fail-soft: an unsupported browser (iOS < 16.4), a
 * denied request, or a low-battery auto-release is a silent no-op, never a
 * user-facing error.
 *
 * The browser auto-releases the lock whenever the tab is hidden, so it's
 * re-acquired on `visibilitychange`. It's also released by our own timer
 * after `keepScreenAwakeMinutes` with no reading activity — `notifyActivity()`
 * (wired to the reader's scroll/tap) resets that timer and re-acquires if the
 * timer had already fired.
 */
export function useWakeLock() {
  const { enabled, minutes } = preferencesStore(
    useShallow((s) => ({
      enabled: s.keepScreenAwake,
      minutes: s.keepScreenAwakeMinutes,
    })),
  );

  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const engagedRef = useRef(false);
  // Read by armTimer (kept identity-stable so notifyActivity — and the reader
  // engine's scroll/tap callbacks it feeds — don't churn when the limit changes).
  const minutesRef = useRef(minutes);
  useEffect(() => {
    minutesRef.current = minutes;
  }, [minutes]);

  const release = useCallback(() => {
    clearTimeout(timerRef.current);
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    void sentinel?.release().catch(() => {});
  }, []);

  const acquire = useCallback(async () => {
    if (!engagedRef.current || sentinelRef.current) return;
    if (!("wakeLock" in navigator)) return;
    if (document.visibilityState !== "visible") return;

    try {
      const sentinel = await navigator.wakeLock.request("screen");
      // The feature may have been turned off (or the reader unmounted) during
      // the await — don't leave an orphan lock held.
      if (!engagedRef.current) {
        void sentinel.release().catch(() => {});
        return;
      }
      sentinelRef.current = sentinel;
      sentinel.addEventListener("release", () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null;
      });
    } catch {
      // unsupported / denied / low battery — silent
    }
  }, []);

  const armTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(release, minutesRef.current * 60_000);
  }, [release]);

  const notifyActivity = useCallback(() => {
    if (!engagedRef.current) return;
    void acquire();
    armTimer();
  }, [acquire, armTimer]);

  useEffect(() => {
    engagedRef.current = enabled;

    if (!enabled) {
      release();
      return;
    }

    void acquire();
    armTimer();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      engagedRef.current = false;
      release();
    };
  }, [enabled, minutes, acquire, armTimer, release]);

  return { notifyActivity };
}
