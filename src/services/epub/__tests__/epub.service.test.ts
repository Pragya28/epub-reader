import JSZip from "jszip";
import { describe, expect, it } from "vitest";
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

  it("rejects a DRM-protected epub before parsing further (Sprint 8 Day 4 item 17)", async () => {
    // Self-contained rather than a fixture file — only the presence of
    // META-INF/encryption.xml matters, checked before container.xml is
    // even read, so no other EPUB structure is needed. Generates as
    // arraybuffer + wraps in a native Blob rather than JSZip's own
    // `type: "blob"` output, which crashes in this test environment
    // (jsdom's Blob support-detection inside JSZip's flate worker) even
    // though it's never exercised elsewhere in this suite (every other
    // test here only ever loads pre-built fixture files, never generates).
    const zip = new JSZip();
    zip.file("META-INF/encryption.xml", "<encryption/>");
    const buffer = await zip.generateAsync({ type: "arraybuffer" });
    const file = new Blob([buffer]);

    await expect(service.extractOpf(file)).rejects.toThrow(
      "This book is protected by DRM and can't be opened.",
    );
  });
});
