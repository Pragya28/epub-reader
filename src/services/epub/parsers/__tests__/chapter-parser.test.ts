import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChapterParser } from "../chapter-parser";
import type { ParsedEpub } from "../../epub-types";

vi.mock("@/shared/logger/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

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
        description: null,
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

    it("marks resolved images as lazy-loaded", async () => {
      const chapter = await parser.parseChapter(zip, parsedEpub, 0, "OPS/");

      expect(chapter.content).toContain('loading="lazy"');
    });

    it("resolves SVG <image xlink:href> assets", async () => {
      zip.file(
        "OPS/text/ch2.xhtml",
        `
          <html xmlns="http://www.w3.org/1999/xhtml">
            <body>
              <svg viewBox="0 0 100 100">
                <image xlink:href="../images/cover.jpg" />
              </svg>
            </body>
          </html>
        `,
      );
      parsedEpub.manifest.ch2 = { href: "text/ch2.xhtml", properties: "" };
      parsedEpub.spine.push("ch2");

      const chapter = await parser.parseChapter(zip, parsedEpub, 1, "OPS/");

      expect(chapter.assetMap.size).toBe(1);
      expect(chapter.content).toContain("blob:");
    });

    it("resolves every image in an image-heavy chapter, skipping only the ones actually missing", async () => {
      zip.file("OPS/images/fig1.jpg", new Uint8Array([1]));
      zip.file("OPS/images/fig2.jpg", new Uint8Array([2]));
      // fig3.jpg intentionally not added to the zip — a real-world case of
      // a manifest/markup referencing an asset that never made it into the
      // archive (bad packaging, not something the reader can fix).
      zip.file(
        "OPS/text/ch2.xhtml",
        `
          <html xmlns="http://www.w3.org/1999/xhtml">
            <body>
              <img src="../images/fig1.jpg" />
              <img src="../images/fig2.jpg" />
              <img src="../images/fig3.jpg" />
            </body>
          </html>
        `,
      );
      parsedEpub.manifest.ch2 = { href: "text/ch2.xhtml", properties: "" };
      parsedEpub.spine.push("ch2");

      const chapter = await parser.parseChapter(zip, parsedEpub, 1, "OPS/");

      expect(chapter.assetMap.size).toBe(2);
      expect(chapter.content.match(/blob:/g)).toHaveLength(2);
      // The missing image's <img> tag survives with its original (now
      // dead) src rather than the chapter parse failing outright — the
      // browser's own broken-image handling (plus the onerror listener
      // added in chapter-renderer.ts) takes it from there.
      expect(chapter.content).toContain("fig3.jpg");
    });

    it("returns correct chapter metadata", async () => {
      const chapter = await parser.parseChapter(zip, parsedEpub, 0, "OPS/");

      expect(chapter.id).toBe("ch1");

      expect(chapter.href).toBe("text/ch1.xhtml");
    });
  });

  describe("countWords", () => {
    it("counts words across every spine chapter", async () => {
      // ch1 (from the shared fixture above) is "Chapter One" — 2 words.
      zip.file(
        "OPS/text/ch2.xhtml",
        `
          <html xmlns="http://www.w3.org/1999/xhtml">
            <body><p>one two three four five</p></body>
          </html>
        `,
      );
      parsedEpub.manifest.ch2 = { href: "text/ch2.xhtml", properties: "" };
      parsedEpub.spine.push("ch2");

      const wordCount = await parser.countWords(zip, parsedEpub, "OPS/");

      expect(wordCount).toBe(2 + 5);
    });

    it("does not let one unreadable chapter sink the whole count", async () => {
      parsedEpub.manifest.missing = {
        href: "text/missing.xhtml",
        properties: "",
      };
      parsedEpub.spine.push("missing");

      const wordCount = await parser.countWords(zip, parsedEpub, "OPS/");

      expect(wordCount).toBe(2);
    });

    it("returns 0 for an empty chapter body", async () => {
      zip.file(
        "OPS/text/empty.xhtml",
        `<html xmlns="http://www.w3.org/1999/xhtml"><body></body></html>`,
      );
      parsedEpub.manifest = {
        empty: { href: "text/empty.xhtml", properties: "" },
      };
      parsedEpub.spine = ["empty"];

      expect(await parser.countWords(zip, parsedEpub, "OPS/")).toBe(0);
    });
  });

  describe("parseAllChapters", () => {
    it("parses all spine items", async () => {
      const chapters = await parser.parseAllChapters(zip, parsedEpub, "OPS/");

      expect(chapters).toHaveLength(1);
    });

    it("degrades gracefully when one chapter's file is missing, instead of failing the whole book", async () => {
      zip.file(
        "OPS/text/ch2.xhtml",
        `<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Chapter Two</h1></body></html>`,
      );
      zip.file(
        "OPS/text/ch3.xhtml",
        `<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Chapter Three</h1></body></html>`,
      );
      parsedEpub.manifest.ch2 = { href: "text/ch2-typo.xhtml", properties: "" }; // wrong path — file won't be found
      parsedEpub.manifest.ch3 = { href: "text/ch3.xhtml", properties: "" };
      parsedEpub.spine = ["ch1", "ch2", "ch3"];

      const chapters = await parser.parseAllChapters(zip, parsedEpub, "OPS/");

      // All three spine positions are still present — chapter count/order
      // stays correct so windowing and TOC navigation don't shift.
      expect(chapters).toHaveLength(3);
      expect(chapters[0]?.content).toContain("Chapter One");
      expect(chapters[1]?.content).toContain("couldn't be loaded");
      expect(chapters[2]?.content).toContain("Chapter Three");
    });

    it("degrades gracefully when a chapter's manifest entry is missing entirely", async () => {
      parsedEpub.spine = ["ch1", "missing-id"];

      const chapters = await parser.parseAllChapters(zip, parsedEpub, "OPS/");

      expect(chapters).toHaveLength(2);
      expect(chapters[1]?.content).toContain("couldn't be loaded");
      expect(chapters[1]?.id).toBe("missing-id");
    });

    it("degrades gracefully when a chapter's markup is unparseable by both XML and HTML parsers", async () => {
      // Neither a well-formed XHTML doc nor recoverable as loose HTML —
      // exercises the fallback path chapter-parser.ts's malformed-XHTML
      // guard doesn't already handle.
      zip.file("OPS/text/ch2.xhtml", "\x00\x01\x02not markup at all\x03");
      parsedEpub.manifest.ch2 = { href: "text/ch2.xhtml", properties: "" };
      parsedEpub.spine = ["ch1", "ch2"];

      const chapters = await parser.parseAllChapters(zip, parsedEpub, "OPS/");

      expect(chapters).toHaveLength(2);
      expect(chapters[0]?.content).toContain("Chapter One");
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

async function createTestZip(chapterContent: string) {
  const zip = new JSZip();

  zip.file(
    "OPS/text/ch1.xhtml",
    `
      <html xmlns="http://www.w3.org/1999/xhtml">
        <head></head>
        <body>
          ${chapterContent}
        </body>
      </html>
    `,
  );

  return zip;
}

const parsedEpub: ParsedEpub = {
  metadata: {
    title: "Test",
    author: "Author",
    language: null,
    description: null,
  },
  manifest: {
    ch1: {
      href: "text/ch1.xhtml",
      properties: "",
    },
  },
  spine: ["ch1"],
};

describe("ChapterParser sanitization", () => {
  const parser = new ChapterParser();

  it("strips <script> tags from chapter content", async () => {
    const zip = await createTestZip(`
      <p>Hello</p>
      <script>alert("xss")</script>
    `);

    const chapter = await parser.parseChapter(zip, parsedEpub, 0, "OPS/");

    expect(chapter.content).not.toContain("<script");
    expect(chapter.content).not.toContain("alert");
    expect(chapter.content).toContain("<p>Hello</p>");
  });

  it("strips inline event-handler attributes", async () => {
    const zip = await createTestZip(`
      <img src="cover.jpg" onerror="alert('xss')" />
    `);

    const chapter = await parser.parseChapter(zip, parsedEpub, 0, "OPS/");

    expect(chapter.content).not.toContain("onerror");
  });

  it("strips javascript: hrefs", async () => {
    const zip = await createTestZip(`
      <a href="javascript:alert('xss')">click</a>
    `);

    const chapter = await parser.parseChapter(zip, parsedEpub, 0, "OPS/");

    expect(chapter.content).not.toContain("javascript:");
  });

  it("preserves ordinary formatting markup", async () => {
    const zip = await createTestZip(`
      <h1>Title</h1>
      <p>
        Some <em>text</em> and
        <strong>bold</strong>.
      </p>
    `);

    const chapter = await parser.parseChapter(zip, parsedEpub, 0, "OPS/");

    expect(chapter.content).toContain("<h1>Title</h1>");
    expect(chapter.content).toContain("<em>text</em>");
    expect(chapter.content).toContain("<strong>bold</strong>");
  });

  it("strips inline style attributes (decision: see sanitize-config.ts)", async () => {
    const zip = await createTestZip(`
      <p style="position: fixed; top: 0; background: url('https://evil.example/track.png')">Hello</p>
    `);

    const chapter = await parser.parseChapter(zip, parsedEpub, 0, "OPS/");

    expect(chapter.content).not.toContain("style=");
    expect(chapter.content).not.toContain("evil.example");
    expect(chapter.content).toContain("Hello");
  });

  it("strips embedded <style> blocks (decision: see sanitize-config.ts)", async () => {
    const zip = await createTestZip(`
      <style>body { background: url('https://evil.example/track.png'); }</style>
      <p>Hello</p>
    `);

    const chapter = await parser.parseChapter(zip, parsedEpub, 0, "OPS/");

    expect(chapter.content).not.toContain("<style");
    expect(chapter.content).not.toContain("evil.example");
    expect(chapter.content).toContain("Hello");
  });
});

describe("ChapterParser CSS asset resolution", () => {
  const parser = new ChapterParser();

  it("neutralizes an absolute url() in a linked stylesheet instead of passing it through", async () => {
    const zip = new JSZip();

    zip.file(
      "OPS/text/ch1.xhtml",
      `
        <html xmlns="http://www.w3.org/1999/xhtml">
          <head>
            <link rel="stylesheet" href="../styles/book.css" />
          </head>
          <body><p>Hello</p></body>
        </html>
      `,
    );
    zip.file(
      "OPS/styles/book.css",
      `body { background: url('https://evil.example/track.png'); }`,
    );

    const chapter = await parser.parseChapter(zip, parsedEpub, 0, "OPS/");

    expect(chapter.stylesheets[0]).not.toContain("evil.example");
    expect(chapter.stylesheets[0]).toContain("url()");
  });

  it("still resolves a same-archive relative url() in a linked stylesheet", async () => {
    const zip = new JSZip();

    zip.file(
      "OPS/text/ch1.xhtml",
      `
        <html xmlns="http://www.w3.org/1999/xhtml">
          <head>
            <link rel="stylesheet" href="../styles/book.css" />
          </head>
          <body><p>Hello</p></body>
        </html>
      `,
    );
    zip.file(
      "OPS/styles/book.css",
      `body { background: url('../images/bg.png'); }`,
    );
    zip.file("OPS/images/bg.png", new Uint8Array([1, 2, 3]));

    const chapter = await parser.parseChapter(zip, parsedEpub, 0, "OPS/");

    expect(chapter.stylesheets[0]).toContain("blob:");
  });
});
