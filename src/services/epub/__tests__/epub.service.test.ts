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
});
