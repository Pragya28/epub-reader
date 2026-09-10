import { useState, type FC } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import type {
  ConflictResolution,
  ProgressConflict,
} from "@/features/library/actions/import-backup";

interface Props {
  conflicts: ProgressConflict[];
  onApply: (resolutions: Map<string, ConflictResolution>) => void;
  onCancel: () => void;
}

/**
 * Shown when a backup being imported has books already in the library at a
 * different chapter. One row per book, defaulting to "keep this device's".
 * Nothing is written until Apply — Cancel aborts the whole import.
 */
export const BackupConflictDialog: FC<Props> = ({
  conflicts,
  onApply,
  onCancel,
}) => {
  const [choices, setChoices] = useState<Map<string, ConflictResolution>>(
    () => new Map(conflicts.map((c) => [c.localId, "keep"])),
  );

  const set = (localId: string, value: ConflictResolution) =>
    setChoices((prev) => new Map(prev).set(localId, value));

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Some books are at a different point
          </AlertDialogTitle>
          <AlertDialogDescription>
            These books are already in your library. Choose which reading
            position to keep for each.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto">
          {conflicts.map((c) => (
            <div key={c.localId} className="flex flex-col gap-2">
              <span className="text-ui font-semibold text-foreground">
                {c.title}
              </span>
              <RadioGroup
                aria-label={c.title}
                value={choices.get(c.localId)}
                onValueChange={(v) => set(c.localId, v as ConflictResolution)}
              >
                <label className="flex items-center gap-2 text-ui-sm">
                  <RadioGroupItem value="keep" />
                  Keep this device&apos;s — chapter {c.localChapter + 1} of{" "}
                  {c.localTotal}
                </label>
                <label className="flex items-center gap-2 text-ui-sm">
                  <RadioGroupItem value="take-backup" />
                  Use backup&apos;s — chapter {c.backupChapter + 1} of{" "}
                  {c.backupTotal}
                </label>
              </RadioGroup>
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onApply(choices)}>Apply</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
