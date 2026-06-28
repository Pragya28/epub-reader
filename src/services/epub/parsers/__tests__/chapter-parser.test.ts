import JSZip from "jszip";
import { beforeEach, describe, expect, it } from "vitest";

import { ChapterParser } from "../chapter-parser";
import type { ParsedEpub } from "../../epub-types";

describe("ChapterParser", () => {
  let zip: JSZip;
  let parser: ChapterParser;
  let parsedEpub: ParsedEpub;

  beforeEach(async () => {
    parser = new ChapterParser();

    zip = new JSZip();

    zip.file(
      "OPS/text/ch1.xhtml",
      `
        <html xmlns="http://www.w3.org/1999/xhtml">
          <head>
            <link
              rel="stylesheet"
              href="../styles/book.css"
            />
          </head>

          <body>
            <h1>Chapter One</h1>

            <img
              src="../images/cover.jpg"
            />
          </body>
        </html>
      `,
    );

    zip.file(
      "OPS/styles/book.css",
      `
        body {
          font-size: 18px;
        }
      `,
    );

    zip.file("OPS/images/cover.jpg", new Uint8Array([1, 2, 3]));

    parsedEpub = {
      metadata: {
        title: "Test",
        author: "Author",
        language: null,
      },

      manifest: {
        ch1: {
          href: "text/ch1.xhtml",
          properties: "",
        },
      },

      spine: ["ch1"],
    };
  });

  describe("parseChapter", () => {
    it("parses chapter content", async () => {
      const chapter = await parser.parseChapter(zip, parsedEpub, 0, "OPS/");

      expect(chapter.content).toContain("Chapter One");
    });

    it("loads chapter stylesheets", async () => {
      const chapter = await parser.parseChapter(zip, parsedEpub, 0, "OPS/");

      expect(chapter.stylesheets).toHaveLength(1);

      expect(chapter.stylesheets[0]).toContain("font-size");
    });

    it("resolves image assets", async () => {
      const chapter = await parser.parseChapter(zip, parsedEpub, 0, "OPS/");

      expect(chapter.assetMap.size).toBe(1);

      expect(chapter.content).toContain("blob:");
    });

    it("returns correct chapter metadata", async () => {
      const chapter = await parser.parseChapter(zip, parsedEpub, 0, "OPS/");

      expect(chapter.id).toBe("ch1");

      expect(chapter.href).toBe("text/ch1.xhtml");
    });
  });

  describe("parseAllChapters", () => {
    it("parses all spine items", async () => {
      const chapters = await parser.parseAllChapters(zip, parsedEpub, "OPS/");

      expect(chapters).toHaveLength(1);
    });
  });

  describe("error handling", () => {
    it("throws for invalid spine index", async () => {
      await expect(
        parser.parseChapter(zip, parsedEpub, 999, "OPS/"),
      ).rejects.toThrow("Invalid spine index");
    });

    it("throws when chapter file is missing", async () => {
      parsedEpub.manifest.ch1.href = "missing.xhtml";

      await expect(
        parser.parseChapter(zip, parsedEpub, 0, "OPS/"),
      ).rejects.toThrow("Chapter not found");
    });

    it("throws when manifest item is missing", async () => {
      parsedEpub.spine = ["missing"];

      await expect(
        parser.parseChapter(zip, parsedEpub, 0, "OPS/"),
      ).rejects.toThrow("Manifest item not found");
    });
  });
});
