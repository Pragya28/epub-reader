import { type FC, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CollectionNameSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onSubmit: (name: string) => void;
}

/** Shared by create and rename — same single-field shape, only the initial
 * value and submit-button copy differ per caller. */
export const CollectionNameSheet: FC<CollectionNameSheetProps> = ({
  open,
  onOpenChange,
  initialName = "",
  onSubmit,
}) => {
  // A collection name is never blank (createCollection/renameCollection
  // both require a trimmed non-empty value), so "non-empty" is an exact
  // stand-in for "the caller passed a rename target."
  const isRename = initialName !== "";
  const [name, setName] = useState(initialName);

  // Reset the field to the current initialName each time the sheet opens
  // (a rename re-open should show the up-to-date name, not a stale typed
  // value) — done during render, not an effect, since it's adjusting state
  // in response to a prop change rather than syncing with anything external.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setName(initialName);
  }

  const trimmed = name.trim();

  const submit = () => {
    if (!trimmed) return;
    onSubmit(trimmed);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex flex-col gap-6 rounded-t-3xl border-t bg-card p-6 pt-8"
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <SheetTitle className="font-heading text-title-sm normal-case tracking-normal">
            {isRename ? "Rename Collection" : "New Collection"}
          </SheetTitle>
          <SheetDescription>
            Gather your thoughts in a bound folio.
          </SheetDescription>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="collection-name"
            className="pl-1 text-meta font-semibold uppercase tracking-[0.6px] text-muted-foreground"
          >
            Collection Name
          </label>
          <Input
            id="collection-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Autumn Reflections"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
          />
        </div>

        <Button onClick={submit} disabled={!trimmed} className="h-14 w-full">
          {isRename ? "Save" : "Create"}
        </Button>
      </SheetContent>
    </Sheet>
  );
};
