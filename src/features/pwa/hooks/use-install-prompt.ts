import { useCallback, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { pwaStore } from "../store/pwa-store";

/** The `beforeinstallprompt` event isn't in the DOM lib types. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
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
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandalone);

  const { installDismissed, setInstallDismissed } = pwaStore(
    useShallow((s) => ({
      installDismissed: s.installDismissed,
      setInstallDismissed: s.setInstallDismissed,
    })),
  );

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return "unavailable" as const;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") setIsInstalled(true);
    return outcome;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setInstallDismissed(true);
  }, [setInstallDismissed]);

  const showIosHint = !isInstalled && !installDismissed && isIosSafari();
  const canInstall = !isInstalled && deferredPrompt !== null;

  return {
    canInstall,
    isInstalled,
    showIosHint,
    installDismissed,
    promptInstall,
    dismiss,
  };
}
