import type { FC } from "react";
import {
  DownloadSimpleIcon,
  ShareNetworkIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { pwaStore } from "../store/pwa-store";
import { useInstallPrompt } from "../hooks/use-install-prompt";

/**
 * Dismissible "install this app" prompt. Shown only after the user's first
 * import (`firstImportDone`) so it lands at a moment they're invested, and
 * never again once dismissed or installed. Styled as a floating paper object
 * like ContinueReadingBanner (`bg-popover` + `--shadow-floating`).
 */
export const InstallBanner: FC = () => {
  const firstImportDone = pwaStore((s) => s.firstImportDone);
  const { canInstall, showIosHint, installDismissed, promptInstall, dismiss } =
    useInstallPrompt();

  if (!firstImportDone || installDismissed || (!canInstall && !showIosHint)) {
    return null;
  }

  return (
    <div className="fixed inset-x-2 bottom-5 z-40 flex items-center gap-3 rounded-xl bg-popover px-3 py-2.5 text-popover-foreground shadow-(--shadow-floating) ring-1 ring-foreground/10">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-popover-foreground/10">
        {showIosHint ? (
          <ShareNetworkIcon size={18} />
        ) : (
          <DownloadSimpleIcon size={18} />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-ui-sm font-semibold leading-tight">
          Install Librune
        </p>
        <p className="text-meta text-popover-foreground/70 leading-snug">
          {showIosHint
            ? "Add to Home Screen from the Share menu for offline reading."
            : "Keep your library one tap away and fully offline."}
        </p>
      </div>

      {canInstall && (
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={() => void promptInstall()}
        >
          Install
        </Button>
      )}

      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Dismiss install prompt"
        className="shrink-0 text-popover-foreground/70 hover:bg-popover-foreground/10"
        onClick={dismiss}
      >
        <XIcon size={16} />
      </Button>
    </div>
  );
};
