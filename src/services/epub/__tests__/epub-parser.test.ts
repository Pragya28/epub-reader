import { describe, expect, it } from "vitest";
import { EpubParser } from "../epub-parser";
import { loadFixture } from "@/tests/utils/load-fixtures";

describe("EpubParser", () => {
  describe("parseBook", () => {
    it("resolves every image across a real image-heavy book to a usable blob URL", async () => {
      const file = await loadFixture("image-heavy.epub");
      const parser = new EpubParser();

      const book = await parser.parseBook(file);

      expect(book.chapters.length).toBeGreaterThan(0);

      const imgTagCount = book.chapters.reduce(
        (count, chapter) =>
          count + (chapter.content.match(/<img\b/g)?.length ?? 0),
        0,
      );
      const resolvedBlobCount = book.chapters.reduce(
        (count, chapter) => count + chapter.assetMap.size,
        0,
      );

      // A real illustrated book — confirms this fixture is genuinely
      // image-heavy and not an accidental near-empty file.
      expect(imgTagCount).toBeGreaterThan(5);
      expect(resolvedBlobCount).toBeGreaterThan(0);

      // Every <img> that survived sanitization resolved to a blob: URL —
      // none were silently left pointing at a dead relative path.
      for (const chapter of book.chapters) {
        const srcs = [...chapter.content.matchAll(/<img[^>]*\ssrc="([^"]*)"/g)];
        for (const [, src] of srcs) {
          expect(src).toMatch(/^blob:/);
        }
      }
    });

    it("parses a real image-heavy book without throwing", async () => {
      const file = await loadFixture("image-heavy.epub");
      const parser = new EpubParser();

      await expect(parser.parseBook(file)).resolves.not.toThrow();
    });
  });
});
