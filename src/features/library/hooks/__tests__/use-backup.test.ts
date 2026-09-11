import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBackup } from "../use-backup";

const exportLibrary = vi.hoisted(() => vi.fn());
const readBackup = vi.hoisted(() => vi.fn());
const applyBackup = vi.hoisted(() => vi.fn());
const loadLibrary = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const downloadBlob = vi.hoisted(() => vi.fn());
const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("../../actions/export-library", () => ({ exportLibrary }));
vi.mock("../../actions/import-backup", () => ({ readBackup, applyBackup }));
vi.mock("@/features/library/actions/load-library", () => ({ loadLibrary }));
vi.mock("@/utils/download-blob", () => ({ downloadBlob }));
vi.mock("@/components/toast/toast", () => ({ notify }));

function fakeFile() {
  return new File(["zip"], "b.zip", { type: "application/zip" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useBackup", () => {
  it("exports and triggers a download", async () => {
    exportLibrary.mockResolvedValue(new Blob(["zip"]));
    const { result } = renderHook(() => useBackup());

    await act(() => result.current.exportNow());

    expect(downloadBlob).toHaveBeenCalledOnce();
    expect(notify.success).toHaveBeenCalledWith("Backup saved");
  });

  it("imports with no conflicts in one step", async () => {
    readBackup.mockResolvedValue({ data: { manifest: {} }, conflicts: [] });
    applyBackup.mockResolvedValue({
      restored: 2,
      skipped: 0,
      conflictsResolved: 0,
      failed: 0,
    });
    const { result } = renderHook(() => useBackup());

    await act(() => result.current.importFile(fakeFile()));

    expect(applyBackup).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Map),
    );
    expect(loadLibrary).toHaveBeenCalledOnce();
    expect(notify.success).toHaveBeenCalled();
  });

  it("pauses on conflicts and resumes with resolutions", async () => {
    const conflicts = [
      {
        localId: "l1",
        title: "T",
        localChapter: 0,
        localTotal: 10,
        backupChapter: 4,
        backupTotal: 10,
      },
    ];
    readBackup.mockResolvedValue({ data: { manifest: {} }, conflicts });
    applyBackup.mockResolvedValue({
      restored: 0,
      skipped: 0,
      conflictsResolved: 1,
      failed: 0,
    });
    const { result } = renderHook(() => useBackup());

    await act(() => result.current.importFile(fakeFile()));
    expect(result.current.conflicts).toEqual(conflicts);
    expect(applyBackup).not.toHaveBeenCalled();

    await act(() =>
      result.current.resolveConflicts(new Map([["l1", "take-backup"]])),
    );
    expect(applyBackup).toHaveBeenCalledWith(
      expect.anything(),
      new Map([["l1", "take-backup"]]),
    );
    await waitFor(() => expect(result.current.conflicts).toBeNull());
  });

  it("shows the format-error message verbatim", async () => {
    const { BackupFormatError } =
      await import("@/services/backup/backup-types");
    readBackup.mockRejectedValue(
      new BackupFormatError("This file isn't a Librune backup."),
    );
    const { result } = renderHook(() => useBackup());

    await act(() => result.current.importFile(fakeFile()));

    expect(notify.error).toHaveBeenCalledWith(
      "This file isn't a Librune backup.",
    );
  });
});
