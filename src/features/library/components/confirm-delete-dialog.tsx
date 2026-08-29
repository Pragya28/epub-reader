import { useState, type FC } from "react";
import { SpinnerIcon } from "@phosphor-icons/react";
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

interface ConfirmDeleteDialogProps {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}

/** Shared by book delete and collection delete — same confirm/cancel shape,
 * only the copy differs per caller. Tracks its own in-flight state: delete
 * touches IndexedDB (search index, cached chapter text, the file blob
 * itself) and can take a beat, so the dialog stays open with a spinner
 * instead of sitting inert with no feedback until the row disappears out
 * from under it. */
export const ConfirmDeleteDialog: FC<ConfirmDeleteDialogProps> = ({
  open,
  title,
  description,
  onConfirm,
  onOpenChange,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={isDeleting ? undefined : onOpenChange}
    >
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <SpinnerIcon className="size-4 animate-spin" />}
            {isDeleting ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
