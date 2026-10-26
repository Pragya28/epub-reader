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
import { Button } from "@/components/ui/button";
import { notify } from "@/components/toast/toast";

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
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      notify.success("Link copied");
      onOpenChange(false);
    } catch {
      notify.error("Couldn't copy link");
    }
  };

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

          <Button variant="outline" onClick={handleCopy}>
            Copy link
          </Button>

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
