import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createArchive, readArchive } from "../backup-archive";
import { BACKUP_VERSION, type BackupData } from "../backup-types";

function sample(): BackupData {
  return {
    manifest: {
      version: BACKUP_VERSION,
      exportedAt: 1_700_000_000_000,
      books: [
        { id: "b1", title: "Book One", createdAt: 1, fileHash: "hash-1" },
      ],
      groupings: [
        {
          id: "g1",
          type: "collection",
          name: "Favorites",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      groupingMembers: [{ groupingId: "g1", bookId: "b1", order: 0 }],
      preferences: {
        theme: "system",
        applyThemeToReader: true,
        readerFont: "literata",
        readerTheme: "system",
        fontScale: 1,
        lineHeight: 1.6,
        margins: 16,
        paragraphSpacing: 8,
        keepScreenAwake: true,
        keepScreenAwakeMinutes: 20,
      },
    },
    files: new Map([["b1", new Blob(["epub-bytes"])]]),
    covers: new Map([["b1", new Blob(["cover-bytes"])]]),
  };
}

describe("backup archive", () => {
  it("round-trips the manifest and blob contents", async () => {
    const restored = await readArchive(await createArchive(sample()));

    expect(restored.manifest).toEqual(sample().manifest);
    expect(await restored.files.get("b1")!.text()).toBe("epub-bytes");
    expect(await restored.covers.get("b1")!.text()).toBe("cover-bytes");
  });

  it("rejects a file that isn't a zip", async () => {
    await expect(readArchive(new Blob(["nope"]))).rejects.toThrow(
      /isn't a Librune backup/,
    );
  });

  it("rejects a zip with no manifest", async () => {
    const zip = new JSZip();
    zip.file("junk.txt", "x");
    await expect(
      readArchive(await zip.generateAsync({ type: "blob" })),
    ).rejects.toThrow(/isn't a Librune backup/);
  });

  it("defaults missing groupings/groupingMembers to empty arrays", async () => {
    const zip = new JSZip();
    zip.file(
      "manifest.json",
      JSON.stringify({ version: BACKUP_VERSION, books: [] }),
    );
    const restored = await readArchive(
      await zip.generateAsync({ type: "blob" }),
    );
    expect(restored.manifest.groupings).toEqual([]);
    expect(restored.manifest.groupingMembers).toEqual([]);
  });

  it("rejects a backup from a newer format version", async () => {
    const data = sample();
    data.manifest.version = BACKUP_VERSION + 1;
    await expect(readArchive(await createArchive(data))).rejects.toThrow(
      /newer version of Librune/,
    );
  });
});
