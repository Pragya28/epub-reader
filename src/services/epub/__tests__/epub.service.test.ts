import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { EpubServiceImpl } from "../epub.service";

describe("EpubService", () => {
  const service = new EpubServiceImpl();

  it("loads fixture", async () => {
    const file = await loadFixture("valid-book.epub");
    expect(file).toBeDefined();
    expect(file.name).toContain("valid-book");
  });

  it("loads valid epub", async () => {
    const file = await loadFixture("valid-book.epub");
    const result = await service.extractOpf(file);
    expect(result).toBeDefined();
  });

  it("handles nested opf paths", async () => {
    const file = await loadFixture("nested-opf.epub");
    const result = await service.extractOpf(file);
    expect(result.opfPath).toBe("OPS/package.opf");
  });

  it("fails for invalid epub", async () => {
    const file = await loadFixture("invalid.epub");
    await expect(service.extractOpf(file)).rejects.toThrow();
  });

  describe("DRM detection (Sprint 8 Day 4 item 17)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("rejects a DRM-protected epub before parsing further", async () => {
      // checkForDrm only calls zip.file("META-INF/encryption.xml") on the
      // JSZip instance loadZip() produces — stubbing JSZip.loadAsync with a
      // synthetic result exercises exactly that check without generating
      // real zip bytes, which sidesteps an intermittent crash in JSZip's
      // own DEFLATE worker under this test environment's parallel worker
      // pool (Cannot read 'uint8array' of undefined in
      // FlateWorker.processChunk, only ever reproduced via generateAsync
      // running alongside the rest of the suite).
      vi.spyOn(JSZip, "loadAsync").mockResolvedValueOnce({
        file: (name: string) =>
          name === "META-INF/encryption.xml" ? {} : null,
      } as any);

      await expect(service.extractOpf(new Blob())).rejects.toThrow(
        "This book is protected by DRM and can't be opened.",
      );
    });
  });
});
