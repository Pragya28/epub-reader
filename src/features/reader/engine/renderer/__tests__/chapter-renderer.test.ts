import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  initializeChapterDocument,
  mountChapter,
  unmountChapter,
} from "../chapter-renderer";
import * as iframeRenderer from "../iframe-renderer";
import type { ParsedChapter } from "@/services/epub/epub-types";

describe("chapter-renderer", () => {
  let iframe: HTMLIFrameElement;
  let doc: Document;

  beforeEach(() => {
    vi.restoreAllMocks();

    iframe = document.createElement("iframe");
    doc = document.implementation.createHTMLDocument("test");
  });

  describe("initializeChapterDocument", () => {
    it("deduplicates stylesheets before passing to initializeReaderDocument", () => {
      const spy = vi.spyOn(iframeRenderer, "initializeReaderDocument");

      const chapters: ParsedChapter[] = [
        {
          id: "ch1",
          href: "text/ch1.xhtml",
          content: "<p>Chapter 1</p>",
          stylesheets: ["body { font-size: 16px; }", "p { color: black; }"],
          assetMap: new Map(),
        },
        {
          id: "ch2",
          href: "text/ch2.xhtml",
          content: "<p>Chapter 2</p>",
          stylesheets: ["body { font-size: 16px; }", "h1 { color: red; }"],
          assetMap: new Map(),
        },
      ];

      initializeChapterDocument(iframe, chapters);

      expect(spy).toHaveBeenCalled();
      const passedStylesheets = spy.mock.calls[0][1];

      // Should have 3 unique stylesheets (body shared, p and h1 unique)
      expect(passedStylesheets).toHaveLength(3);
      expect(passedStylesheets).toContain("body { font-size: 16px; }");
      expect(passedStylesheets).toContain("p { color: black; }");
      expect(passedStylesheets).toContain("h1 { color: red; }");
    });

    it("removes duplicate stylesheets when chapters share CSS", () => {
      const spy = vi.spyOn(iframeRenderer, "initializeReaderDocument");

      const sharedStyle = "body { line-height: 1.5; }";
      const chapters: ParsedChapter[] = [
        {
          id: "ch1",
          href: "text/ch1.xhtml",
          content: "<p>Chapter 1</p>",
          stylesheets: [sharedStyle, "p { margin: 1em; }"],
          assetMap: new Map(),
        },
        {
          id: "ch2",
          href: "text/ch2.xhtml",
          content: "<p>Chapter 2</p>",
          stylesheets: [sharedStyle, "p { padding: 0; }"],
          assetMap: new Map(),
        },
        {
          id: "ch3",
          href: "text/ch3.xhtml",
          content: "<p>Chapter 3</p>",
          stylesheets: [sharedStyle],
          assetMap: new Map(),
        },
      ];

      initializeChapterDocument(iframe, chapters);

      const passedStylesheets = spy.mock.calls[0][1];
      const sharedCount = passedStylesheets.filter(
        (s) => s === sharedStyle,
      ).length;

      // Shared style should appear only once despite being in 3 chapters
      expect(sharedCount).toBe(1);
    });

    it("handles single chapter", () => {
      const spy = vi.spyOn(iframeRenderer, "initializeReaderDocument");

      const chapters: ParsedChapter[] = [
        {
          id: "ch1",
          href: "text/ch1.xhtml",
          content: "<p>Only Chapter</p>",
          stylesheets: ["body { font-size: 18px; }"],
          assetMap: new Map(),
        },
      ];

      initializeChapterDocument(iframe, chapters);

      expect(spy).toHaveBeenCalledWith(
        iframe,
        ["body { font-size: 18px; }"],
        undefined,
      );
    });

    it("handles empty stylesheets array per chapter", () => {
      const spy = vi.spyOn(iframeRenderer, "initializeReaderDocument");

      const chapters: ParsedChapter[] = [
        {
          id: "ch1",
          href: "text/ch1.xhtml",
          content: "<p>No styles</p>",
          stylesheets: [],
          assetMap: new Map(),
        },
        {
          id: "ch2",
          href: "text/ch2.xhtml",
          content: "<p>Also no styles</p>",
          stylesheets: [],
          assetMap: new Map(),
        },
      ];

      initializeChapterDocument(iframe, chapters);

      const passedStylesheets = spy.mock.calls[0][1];
      expect(passedStylesheets).toEqual([]);
    });

    it("passes iframe instance correctly", () => {
      const spy = vi.spyOn(iframeRenderer, "initializeReaderDocument");

      const chapters: ParsedChapter[] = [
        {
          id: "ch1",
          href: "text/ch1.xhtml",
          content: "<p>Test</p>",
          stylesheets: [],
          assetMap: new Map(),
        },
      ];

      initializeChapterDocument(iframe, chapters);

      expect(spy).toHaveBeenCalledWith(iframe, expect.any(Array), undefined);
    });

    it("preserves stylesheet order while deduplicating", () => {
      const spy = vi.spyOn(iframeRenderer, "initializeReaderDocument");

      const chapters: ParsedChapter[] = [
        {
          id: "ch1",
          href: "text/ch1.xhtml",
          content: "<p>Chapter 1</p>",
          stylesheets: ["/* first */", "/* second */", "/* third */"],
          assetMap: new Map(),
        },
      ];

      initializeChapterDocument(iframe, chapters);

      const passedStylesheets = spy.mock.calls[0][1];
      expect(passedStylesheets).toEqual([
        "/* first */",
        "/* second */",
        "/* third */",
      ]);
    });
  });

  describe("mountChapter", () => {
    it("calls mountChapterSection with chapter content and index", () => {
      const spy = vi.spyOn(iframeRenderer, "mountChapterSection");

      const chapter: ParsedChapter = {
        id: "ch1",
        href: "text/ch1.xhtml",
        content: "<h1>Chapter One</h1><p>Content here</p>",
        stylesheets: [],
        assetMap: new Map(),
      };

      mountChapter(doc, chapter, 0);

      expect(spy).toHaveBeenCalledWith(
        doc,
        "<h1>Chapter One</h1><p>Content here</p>",
        0,
      );
    });

    it("uses correct chapter index", () => {
      const spy = vi.spyOn(iframeRenderer, "mountChapterSection");

      const chapter: ParsedChapter = {
        id: "ch5",
        href: "text/ch5.xhtml",
        content: "<p>Chapter Five</p>",
        stylesheets: [],
        assetMap: new Map(),
      };

      mountChapter(doc, chapter, 5);

      expect(spy).toHaveBeenCalledWith(doc, expect.any(String), 5);
    });

    it("passes document instance to renderer", () => {
      const spy = vi.spyOn(iframeRenderer, "mountChapterSection");

      const chapter: ParsedChapter = {
        id: "ch1",
        href: "text/ch1.xhtml",
        content: "<p>Test</p>",
        stylesheets: [],
        assetMap: new Map(),
      };

      mountChapter(doc, chapter, 0);

      expect(spy.mock.calls[0][0]).toBe(doc);
    });

    it("handles chapter with complex HTML content", () => {
      const spy = vi.spyOn(iframeRenderer, "mountChapterSection");

      const complexContent = `
        <article>
          <h1>Title</h1>
          <section>
            <p>Paragraph 1</p>
            <p>Paragraph 2</p>
          </section>
          <img src="image.jpg" alt="illustration" />
        </article>
      `;

      const chapter: ParsedChapter = {
        id: "ch1",
        href: "text/ch1.xhtml",
        content: complexContent,
        stylesheets: [],
        assetMap: new Map(),
      };

      mountChapter(doc, chapter, 0);

      expect(spy).toHaveBeenCalledWith(doc, complexContent, 0);
    });
  });

  describe("unmountChapter", () => {
    it("calls unmountChapterSection with correct index", () => {
      const spy = vi.spyOn(iframeRenderer, "unmountChapterSection");

      unmountChapter(doc, 3);

      expect(spy).toHaveBeenCalledWith(doc, 3);
    });

    it("passes document instance to renderer", () => {
      const spy = vi.spyOn(iframeRenderer, "unmountChapterSection");

      unmountChapter(doc, 0);

      expect(spy.mock.calls[0][0]).toBe(doc);
    });

    it("handles unmounting chapter at index 0", () => {
      const spy = vi.spyOn(iframeRenderer, "unmountChapterSection");

      unmountChapter(doc, 0);

      expect(spy).toHaveBeenCalledWith(doc, 0);
    });

    it("handles unmounting high-index chapters", () => {
      const spy = vi.spyOn(iframeRenderer, "unmountChapterSection");

      unmountChapter(doc, 999);

      expect(spy).toHaveBeenCalledWith(doc, 999);
    });
  });

  describe("integration", () => {
    it("flow: initialize document with multiple chapters' stylesheets, then mount/unmount individual chapters", () => {
      const initSpy = vi.spyOn(iframeRenderer, "initializeReaderDocument");
      const mountSpy = vi.spyOn(iframeRenderer, "mountChapterSection");
      const unmountSpy = vi.spyOn(iframeRenderer, "unmountChapterSection");

      const chapters: ParsedChapter[] = [
        {
          id: "ch0",
          href: "text/ch0.xhtml",
          content: "<p>Chapter 0</p>",
          stylesheets: ["body { font-size: 16px; }"],
          assetMap: new Map(),
        },
        {
          id: "ch1",
          href: "text/ch1.xhtml",
          content: "<p>Chapter 1</p>",
          stylesheets: ["body { font-size: 16px; }"],
          assetMap: new Map(),
        },
      ];

      // Initialize with all chapters' styles
      initializeChapterDocument(iframe, chapters);
      expect(initSpy).toHaveBeenCalled();

      // Mount individual chapters
      mountChapter(doc, chapters[0], 0);
      expect(mountSpy).toHaveBeenCalledWith(doc, "<p>Chapter 0</p>", 0);

      mountChapter(doc, chapters[1], 1);
      expect(mountSpy).toHaveBeenCalledWith(doc, "<p>Chapter 1</p>", 1);

      // Unmount one
      unmountChapter(doc, 0);
      expect(unmountSpy).toHaveBeenCalledWith(doc, 0);
    });
  });
});
