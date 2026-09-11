import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BackupConflictDialog } from "../backup-conflict-dialog";

const conflicts = [
  {
    localId: "l1",
    title: "Anna Karenina",
    localChapter: 3,
    localTotal: 20,
    backupChapter: 7,
    backupTotal: 20,
  },
];

describe("BackupConflictDialog", () => {
  it("defaults every book to 'keep' and applies choices", async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(
      <BackupConflictDialog
        conflicts={conflicts}
        onApply={onApply}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/Anna Karenina/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /apply/i }));
    expect(onApply).toHaveBeenCalledWith(new Map([["l1", "keep"]]));
  });

  it("records a per-book 'use backup' choice", async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(
      <BackupConflictDialog
        conflicts={conflicts}
        onApply={onApply}
        onCancel={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("radio", { name: /use backup.*chapter 8/i }),
    );
    await user.click(screen.getByRole("button", { name: /apply/i }));
    expect(onApply).toHaveBeenCalledWith(new Map([["l1", "take-backup"]]));
  });

  it("cancels", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <BackupConflictDialog
        conflicts={conflicts}
        onApply={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
