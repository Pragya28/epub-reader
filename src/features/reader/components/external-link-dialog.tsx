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

interface ExternalLinkDialogProps {
  open: boolean;
  href: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export const ExternalLinkDialog: FC<ExternalLinkDialogProps> = ({
  open,
  href,
  onConfirm,
  onOpenChange,
}) => {
  const display = href.replace(/^[a-z][a-z\d+\-.]*:\/\//i, "");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Open external link?</AlertDialogTitle>

          <AlertDialogDescription
            className="break-all text-muted-foreground"
            title={href}
          >
            {display}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>

          <AlertDialogAction
            onClick={onConfirm}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            Open
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
