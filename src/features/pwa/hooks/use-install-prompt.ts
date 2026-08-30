import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useShallow } from "zustand/react/shallow";
import { pwaStore } from "../store/pwa-store";

/** The `beforeinstallprompt` event isn't in the DOM lib types. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// `beforeinstallprompt` fires once per page load — before any particular
// component mounts. Capture it at module scope so every consumer of this hook
// (the library InstallBanner AND the Settings "Install app" row) sees it, not
// just whichever one happened to be mounted when it fired.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit();
  });
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Test-only: clear the module-level captured event between test cases. */
export function __resetDeferredPrompt() {
  deferredPrompt = null;
  emit();
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ reports a Mac UA but exposes touch — treat as iOS.
  const isIpadOs =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (isIos || isIpadOs) && !standalone;
}

function isStandalone(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(display-mode: standalone)").matches === true
  );
}

/**
 * Captures the deferred `beforeinstallprompt` event so the app can offer
 * install at a natural moment (after a first import) rather than letting the
 * browser's default mini-infobar fire on cold load. On iOS Safari — which has
 * no such event — exposes `showIosHint` so the UI can point at Add to Home
 * Screen instead.
 */
export function useInstallPrompt() {
  const promptEvent = useSyncExternalStore(
    subscribe,
    () => deferredPrompt,
    () => null,
  );
  const [isInstalled, setIsInstalled] = useState(isStandalone);

  const { installDismissed, setInstallDismissed } = pwaStore(
    useShallow((s) => ({
      installDismissed: s.installDismissed,
      setInstallDismissed: s.setInstallDismissed,
    })),
  );

  useEffect(() => {
    const onAppInstalled = () => setIsInstalled(true);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => window.removeEventListener("appinstalled", onAppInstalled);
  }, []);

  const promptInstall = useCallback(async () => {
    const event = deferredPrompt;
    if (!event) return "unavailable" as const;

    // Consume it before awaiting so a double-tap can't call prompt() twice
    // (the second call rejects with InvalidStateError).
    deferredPrompt = null;
    emit();

    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    return outcome;
  }, []);

  const dismiss = useCallback(() => {
    setInstallDismissed(true);
  }, [setInstallDismissed]);

  const showIosHint = !isInstalled && !installDismissed && isIosSafari();
  const canInstall = !isInstalled && promptEvent !== null;

  return {
    canInstall,
    isInstalled,
    showIosHint,
    installDismissed,
    promptInstall,
    dismiss,
  };
}
