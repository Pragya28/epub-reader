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

      // Chapters come back as stubs — chapter bodies are only parsed on
      // demand via loadChapter (see epub-parser.ts), not all eagerly here.
      const loadedChapters = await Promise.all(
        book.chapters.map((_, index) => book.loadChapter(index)),
      );

      const imgTagCount = loadedChapters.reduce(
        (count, chapter) =>
          count + (chapter.content.match(/<img\b/g)?.length ?? 0),
        0,
      );
      const resolvedBlobCount = loadedChapters.reduce(
        (count, chapter) => count + chapter.assetMap.size,
        0,
      );

      // A real illustrated book — confirms this fixture is genuinely
      // image-heavy and not an accidental near-empty file.
      expect(imgTagCount).toBeGreaterThan(5);
      expect(resolvedBlobCount).toBeGreaterThan(0);

      // Every <img> that survived sanitization resolved to a blob: URL —
      // none were silently left pointing at a dead relative path.
      for (const chapter of loadedChapters) {
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

    it("returns chapters as unparsed stubs, not eagerly parsed content", async () => {
      const file = await loadFixture("image-heavy.epub");
      const parser = new EpubParser();

      const book = await parser.parseBook(file);

      // The whole point: parseBook itself never touches chapter bodies.
      for (const chapter of book.chapters) {
        expect(chapter.content).toBe("");
        expect(chapter.assetMap.size).toBe(0);
      }
    });

    it("loadChapter populates the chapters[] entry in place once resolved", async () => {
      const file = await loadFixture("image-heavy.epub");
      const parser = new EpubParser();

      const book = await parser.parseBook(file);
      expect(book.chapters[0]?.content).toBe("");

      const loaded = await book.loadChapter(0);

      expect(loaded.content).not.toBe("");
      expect(book.chapters[0]).toBe(loaded);
    });

    it("memoizes loadChapter — concurrent calls for the same index share one parse", async () => {
      const file = await loadFixture("image-heavy.epub");
      const parser = new EpubParser();

      const book = await parser.parseBook(file);

      const [first, second] = await Promise.all([
        book.loadChapter(0),
        book.loadChapter(0),
      ]);

      expect(first).toBe(second);
    });

    it("loads book-level stylesheets eagerly, independent of chapter parsing", async () => {
      const file = await loadFixture("image-heavy.epub");
      const parser = new EpubParser();

      const book = await parser.parseBook(file);

      expect(book.stylesheets.length).toBeGreaterThan(0);
    });
  });

  describe("parseLibraryBook", () => {
    it("computes chapter count, word count and reading time for a real book", async () => {
      const file = await loadFixture("valid-book.epub");
      const parser = new EpubParser();

      const book = await parser.parseLibraryBook(file);

      expect(book.chapterCount).toBeGreaterThan(0);
      expect(book.wordCount).toBeGreaterThan(0);
      expect(book.readingTimeMinutes).toBe(Math.ceil(book.wordCount / 200));
    });

    it("estimates at least 1 minute for a book with no readable words", async () => {
      const file = await loadFixture("missing-metadata.epub");
      const parser = new EpubParser();

      const book = await parser.parseLibraryBook(file);

      expect(book.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });
  });
});
