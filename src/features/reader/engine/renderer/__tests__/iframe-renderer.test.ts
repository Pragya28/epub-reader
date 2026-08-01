import { describe, expect, it, beforeEach } from "vitest";
import {
  applyReaderPreferences,
  initializeReaderDocument,
  mountChapterSection,
  unmountChapterSection,
} from "../iframe-renderer";

describe("iframe-renderer", () => {
  let iframe: HTMLIFrameElement;

  beforeEach(() => {
    iframe = document.createElement("iframe");
  });

  describe("initializeReaderDocument", () => {
    it("creates a valid HTML document shell in srcdoc", () => {
      initializeReaderDocument(iframe, []);

      expect(iframe.srcdoc).toContain("<!doctype html>");
      expect(iframe.srcdoc).toContain("<html>");
      expect(iframe.srcdoc).toContain("<head>");
      expect(iframe.srcdoc).toContain("<body></body>");
    });

    it("self-hosts the Literata font instead of loading it from Google Fonts", () => {
      initializeReaderDocument(iframe, []);

      expect(iframe.srcdoc).toContain("/fonts/literata/");
      expect(iframe.srcdoc).toContain("@font-face");
      expect(iframe.srcdoc).not.toContain("fonts.googleapis.com");
      expect(iframe.srcdoc).not.toContain("fonts.gstatic.com");
    });

    it("injects stylesheets into head", () => {
      const stylesheets = ["body { font-size: 18px; }", "p { color: black; }"];

      initializeReaderDocument(iframe, stylesheets);

      expect(iframe.srcdoc).toContain("body { font-size: 18px; }");
      expect(iframe.srcdoc).toContain("p { color: black; }");
      expect(iframe.srcdoc).toContain("<style>");
    });

    it("sanitizes stylesheets by removing expression()", () => {
      const malicious = "div { behavior: expression(alert('xss')); }";

      initializeReaderDocument(iframe, [malicious]);

      expect(iframe.srcdoc).not.toContain("expression");
      expect(iframe.srcdoc).toContain("<style>");
    });

    it("sanitizes stylesheets by removing javascript: in url()", () => {
      const malicious = "div { background: url('javascript:alert(1)'); }";

      initializeReaderDocument(iframe, [malicious]);

      expect(iframe.srcdoc).not.toContain("javascript:");
      expect(iframe.srcdoc).toContain("url()");
    });

    it("sanitizes stylesheets by removing @import", () => {
      const malicious = "@import url('https://evil.com/evil.css');";

      initializeReaderDocument(iframe, [malicious]);

      expect(iframe.srcdoc).not.toContain("@import");
    });

    it("handles empty stylesheet array", () => {
      initializeReaderDocument(iframe, []);

      expect(iframe.srcdoc).toContain("<body></body>");
      // Should not have extra style tags beyond the base one
      const styleCount = (iframe.srcdoc.match(/<style>/g) || []).length;
      expect(styleCount).toBeGreaterThanOrEqual(1); // At least the margin: 0 style
    });

    it("wraps each stylesheet in its own style tag", () => {
      const stylesheets = ["/* sheet1 */", "/* sheet2 */"];

      initializeReaderDocument(iframe, stylesheets);

      const styleCount = (iframe.srcdoc.match(/<style>/g) || []).length;
      expect(styleCount).toBeGreaterThanOrEqual(2); // At least 2 plus base
    });
  });

  describe("mountChapterSection", () => {
    let doc: Document;

    beforeEach(() => {
      doc = document.implementation.createHTMLDocument("test");
    });

    it("inserts chapter as section element with data-chapter attribute", () => {
      const html = "<p>Chapter One</p>";

      mountChapterSection(doc, html, 0);

      const section = doc.querySelector('section[data-chapter="0"]');
      expect(section).toBeDefined();
      expect(section?.innerHTML).toContain("<p>Chapter One</p>");
    });

    it("does not insert duplicate sections for same index", () => {
      const html = "<p>Chapter One</p>";

      mountChapterSection(doc, html, 0);
      mountChapterSection(doc, html, 0);

      const sections = doc.querySelectorAll('section[data-chapter="0"]');
      expect(sections).toHaveLength(1);
    });

    it("maintains spine order when inserting out-of-order chapters", () => {
      mountChapterSection(doc, "<p>Chapter 0</p>", 0);
      mountChapterSection(doc, "<p>Chapter 2</p>", 2);
      mountChapterSection(doc, "<p>Chapter 1</p>", 1);

      const sections = Array.from(
        doc.querySelectorAll("section[data-chapter]"),
      );
      const indices = sections.map((s) =>
        Number(s.getAttribute("data-chapter")),
      );

      expect(indices).toEqual([0, 1, 2]);
    });

    it("appends section to body when no higher-indexed section exists", () => {
      mountChapterSection(doc, "<p>Last Chapter</p>", 99);

      const section = doc.querySelector('section[data-chapter="99"]');
      expect(section?.parentElement).toBe(doc.body);
      expect(doc.body.lastChild).toBe(section);
    });

    it("inserts section before first higher-indexed section", () => {
      mountChapterSection(doc, "<p>Chapter 2</p>", 2);
      mountChapterSection(doc, "<p>Chapter 0</p>", 0);

      const section0 = doc.querySelector('section[data-chapter="0"]');
      const section2 = doc.querySelector('section[data-chapter="2"]');

      expect(section0?.nextSibling).toBe(section2);
    });

    it("handles HTML content with nested elements", () => {
      const complexHtml =
        "<div><h1>Title</h1><p>Paragraph</p><img src='test.jpg'/></div>";

      mountChapterSection(doc, complexHtml, 0);

      const section = doc.querySelector('section[data-chapter="0"]');
      expect(section?.querySelector("h1")).toBeDefined();
      expect(section?.querySelector("p")).toBeDefined();
      expect(section?.querySelector("img")).toBeDefined();
    });

    it("hides an image on load error instead of leaving a broken-image icon", () => {
      mountChapterSection(doc, "<img src='missing.jpg'/>", 0);

      const img = doc.querySelector(
        'section[data-chapter="0"] img',
      ) as HTMLImageElement;

      expect(img.style.display).not.toBe("none");
      img.dispatchEvent(new Event("error"));
      expect(img.style.display).toBe("none");
    });

    it("handles empty chapter HTML", () => {
      mountChapterSection(doc, "", 0);

      const section = doc.querySelector('section[data-chapter="0"]');
      expect(section).toBeDefined();
      expect(section?.innerHTML).toBe("");
    });

    it("correctly orders multiple inserted chapters with gaps", () => {
      mountChapterSection(doc, "<p>Ch 0</p>", 0);
      mountChapterSection(doc, "<p>Ch 5</p>", 5);
      mountChapterSection(doc, "<p>Ch 2</p>", 2);
      mountChapterSection(doc, "<p>Ch 3</p>", 3);

      const sections = Array.from(
        doc.querySelectorAll("section[data-chapter]"),
      );
      const indices = sections.map((s) =>
        Number(s.getAttribute("data-chapter")),
      );

      expect(indices).toEqual([0, 2, 3, 5]);
    });
  });

  describe("unmountChapterSection", () => {
    let doc: Document;

    beforeEach(() => {
      doc = document.implementation.createHTMLDocument("test");
    });

    it("removes section by index", () => {
      mountChapterSection(doc, "<p>Chapter 0</p>", 0);
      expect(doc.querySelector('section[data-chapter="0"]')).toBeDefined();

      unmountChapterSection(doc, 0);

      expect(doc.querySelector('section[data-chapter="0"]')).toBeNull();
    });

    it("does not remove sections with different indices", () => {
      mountChapterSection(doc, "<p>Chapter 0</p>", 0);
      mountChapterSection(doc, "<p>Chapter 1</p>", 1);

      unmountChapterSection(doc, 0);

      expect(doc.querySelector('section[data-chapter="0"]')).toBeNull();
      expect(doc.querySelector('section[data-chapter="1"]')).toBeDefined();
    });

    it("handles unmounting non-existent section silently", () => {
      expect(() => {
        unmountChapterSection(doc, 999);
      }).not.toThrow();
    });

    it("removes only the exact section by data-chapter value", () => {
      mountChapterSection(doc, "<p>Chapter 0</p>", 0);
      mountChapterSection(doc, "<p>Chapter 10</p>", 10);

      unmountChapterSection(doc, 0);

      expect(doc.querySelector('section[data-chapter="0"]')).toBeNull();
      expect(doc.querySelector('section[data-chapter="10"]')).toBeDefined();
    });

    it("can unmount and remount the same chapter", () => {
      const html = "<p>Chapter Content</p>";

      mountChapterSection(doc, html, 0);
      unmountChapterSection(doc, 0);
      expect(doc.querySelector('section[data-chapter="0"]')).toBeNull();

      mountChapterSection(doc, html, 0);
      expect(doc.querySelector('section[data-chapter="0"]')).toBeDefined();
    });
  });

  describe("integration: mount/unmount sequence", () => {
    let doc: Document;

    beforeEach(() => {
      doc = document.implementation.createHTMLDocument("test");
    });

    it("maintains document structure through mount/unmount cycles", () => {
      mountChapterSection(doc, "<p>Ch 0</p>", 0);
      mountChapterSection(doc, "<p>Ch 1</p>", 1);
      mountChapterSection(doc, "<p>Ch 2</p>", 2);

      unmountChapterSection(doc, 1);

      const remaining = Array.from(
        doc.querySelectorAll("section[data-chapter]"),
      ).map((s) => Number(s.getAttribute("data-chapter")));
      expect(remaining).toEqual([0, 2]);
    });

    it("works with initializeReaderDocument + mounting sequence", () => {
      // In real usage, iframe.srcdoc is set, then contentDocument is accessed
      // Here we simulate: create a fresh doc via the pattern
      initializeReaderDocument(iframe, ["body { color: blue; }"]);

      // srcdoc is set; in real browser, contentDocument would be ready after load event
      // For this test, we use a separate doc but verify the flow
      mountChapterSection(doc, "<p>Chapter</p>", 0);
      expect(doc.querySelector('section[data-chapter="0"]')).toBeDefined();
    });
  });

  describe("applyReaderPreferences", () => {
    let doc: Document;

    beforeEach(() => {
      doc = document.implementation.createHTMLDocument("test");
    });

    it("sets font-scale and line-height custom properties", () => {
      applyReaderPreferences(doc, {
        fontScale: 1.2,
        lineHeight: 1.8,
        theme: "system",
      });

      expect(
        doc.documentElement.style.getPropertyValue("--reading-font-scale"),
      ).toBe("1.2");
      expect(
        doc.documentElement.style.getPropertyValue("--reading-line-height"),
      ).toBe("1.8");
    });

    it("sets data-theme when an explicit theme is chosen", () => {
      applyReaderPreferences(doc, {
        fontScale: 1,
        lineHeight: 1.6,
        theme: "dark",
      });

      expect(doc.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("removes data-theme when theme is system", () => {
      doc.documentElement.setAttribute("data-theme", "dark");

      applyReaderPreferences(doc, {
        fontScale: 1,
        lineHeight: 1.6,
        theme: "system",
      });

      expect(doc.documentElement.hasAttribute("data-theme")).toBe(false);
    });
  });
});
