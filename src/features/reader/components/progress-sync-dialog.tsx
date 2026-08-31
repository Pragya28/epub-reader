import type { FC } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProgressSyncDialogProps {
  open: boolean;
  onReload: () => void;
  onOpenChange: (open: boolean) => void;
}

/** Surfaces a newer reading-progress save made in another tab, so this
 * tab's next save can't silently clobber it (Sprint 8 Day 4 item 21) —
 * last-write-wins at the storage layer is unchanged, this just makes the
 * conflict visible instead of silent. Reloading re-enters the reader
 * through the normal load path, landing on the synced position. */
export const ProgressSyncDialog: FC<ProgressSyncDialogProps> = ({
  open,
  onReload,
  onOpenChange,
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Progress updated in another tab</AlertDialogTitle>
        <AlertDialogDescription>
          You read further in another tab. Reload to continue from there, or
          keep reading here — but your next save may overwrite it.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel>Keep reading here</AlertDialogCancel>
        <AlertDialogAction
          onClick={onReload}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          Reload
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
