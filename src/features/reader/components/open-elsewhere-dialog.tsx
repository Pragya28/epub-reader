import type { FC } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OpenElsewhereDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Notifies the reader that the same book is also open in another tab —
 * a passive heads-up, not a lock (Sprint 8 Day 4 item 21). */
export const OpenElsewhereDialog: FC<OpenElsewhereDialogProps> = ({
  open,
  onOpenChange,
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Also open in another tab</AlertDialogTitle>
        <AlertDialogDescription>
          You&apos;re reading this book in another tab too. Progress syncs
          automatically when you switch back here.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogAction onClick={() => onOpenChange(false)}>
          Got it
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
