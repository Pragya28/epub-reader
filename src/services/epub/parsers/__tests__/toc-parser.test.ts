import { describe, expect, it } from "vitest";
import { TocParser } from "../toc-parser";
import type { ParsedEpub } from "../../epub-types";

// Minimal JSZip-shaped mock: just the file() method
function makeZip(files: Record<string, string>) {
  return {
    file: (path: string) => {
      const content = files[path];
      if (!content) return null;
      return { async: (_: string) => Promise.resolve(content) };
    },
  } as any;
}

function makeEpub(
  spineIds: string[],
  manifest: Record<string, { href: string; properties: string }>,
): ParsedEpub {
  return {
    metadata: { title: "Test", author: "Author", language: "en" },
    manifest,
    spine: spineIds,
  };
}

const EPUB3_NAV = `
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <body>
    <nav epub:type="toc">
      <ol>
        <li><a href="text/chapter-1.xhtml">Chapter One</a></li>
        <li>
          <a href="text/chapter-2.xhtml">Chapter Two</a>
          <ol>
            <li><a href="text/chapter-2.xhtml#section-1">Section A</a></li>
          </ol>
        </li>
        <li><a href="text/chapter-3.xhtml">Chapter Three</a></li>
      </ol>
    </nav>
  </body>
</html>
`;

const EPUB2_NCX = `
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
  <navMap>
    <navPoint id="np1">
      <navLabel><text>Chapter One</text></navLabel>
      <content src="text/chapter-1.xhtml"/>
    </navPoint>
    <navPoint id="np2">
      <navLabel><text>Chapter Two</text></navLabel>
      <content src="text/chapter-2.xhtml"/>
      <navPoint id="np2a">
        <navLabel><text>Section A</text></navLabel>
        <content src="text/chapter-2.xhtml#section-1"/>
      </navPoint>
    </navPoint>
  </navMap>
</ncx>
`;

const MANIFEST = {
  ch1: { href: "text/chapter-1.xhtml", properties: "" },
  ch2: { href: "text/chapter-2.xhtml", properties: "" },
  ch3: { href: "text/chapter-3.xhtml", properties: "" },
  nav: { href: "toc.xhtml", properties: "nav" },
  ncx: { href: "toc.ncx", properties: "" },
};

describe("TocParser", () => {
  const parser = new TocParser();
  const opfDirectory = "epub/";

  describe("EPUB3 nav parsing", () => {
    const epub = makeEpub(["ch1", "ch2", "ch3"], MANIFEST);
    const zip = makeZip({ "epub/toc.xhtml": EPUB3_NAV });

    it("parses top-level items", async () => {
      const toc = await parser.parse(zip, epub, opfDirectory);
      expect(toc).toHaveLength(3);
      expect(toc[0]?.label).toBe("Chapter One");
      expect(toc[1]?.label).toBe("Chapter Two");
      expect(toc[2]?.label).toBe("Chapter Three");
    });

    it("parses nested children", async () => {
      const toc = await parser.parse(zip, epub, opfDirectory);
      expect(toc[1]?.children).toHaveLength(1);
      expect(toc[1]?.children[0]?.label).toBe("Section A");
    });

    it("resolves chapterIndex from spine", async () => {
      const toc = await parser.parse(zip, epub, opfDirectory);
      expect(toc[0]?.chapterIndex).toBe(0);
      expect(toc[1]?.chapterIndex).toBe(1);
      expect(toc[2]?.chapterIndex).toBe(2);
    });

    it("resolves fragmentId from href", async () => {
      const toc = await parser.parse(zip, epub, opfDirectory);
      const sectionA = toc[1]?.children[0];
      expect(sectionA?.chapterIndex).toBe(1);
      expect(sectionA?.fragmentId).toBe("section-1");
    });

    it("sets chapterIndex -1 for hrefs not in spine", async () => {
      const epub2 = makeEpub(["ch1"], {
        ch1: { href: "text/chapter-1.xhtml", properties: "" },
        nav: { href: "toc.xhtml", properties: "nav" },
      });
      const toc = await parser.parse(zip, epub2, opfDirectory);
      // chapter-2 and chapter-3 not in spine
      expect(toc[1]?.chapterIndex).toBe(-1);
    });

    it("sets no fragmentId when href has no fragment", async () => {
      const toc = await parser.parse(zip, epub, opfDirectory);
      expect(toc[0]?.fragmentId).toBeUndefined();
    });
  });

  describe("EPUB2 NCX fallback", () => {
    const epubNoNav = makeEpub(["ch1", "ch2"], {
      ch1: { href: "text/chapter-1.xhtml", properties: "" },
      ch2: { href: "text/chapter-2.xhtml", properties: "" },
      ncx: { href: "toc.ncx", properties: "" },
    });
    const zip = makeZip({ "epub/toc.ncx": EPUB2_NCX });

    it("falls back to NCX when no nav item in manifest", async () => {
      const toc = await parser.parse(zip, epubNoNav, opfDirectory);
      expect(toc).toHaveLength(2);
      expect(toc[0]?.label).toBe("Chapter One");
    });

    it("resolves chapterIndex from NCX", async () => {
      const toc = await parser.parse(zip, epubNoNav, opfDirectory);
      expect(toc[0]?.chapterIndex).toBe(0);
      expect(toc[1]?.chapterIndex).toBe(1);
    });

    it("resolves nested NCX navPoints", async () => {
      const toc = await parser.parse(zip, epubNoNav, opfDirectory);
      expect(toc[1]?.children).toHaveLength(1);
      expect(toc[1]?.children[0]?.fragmentId).toBe("section-1");
    });
  });

  describe("empty / missing TOC", () => {
    it("returns empty array when no nav or ncx in manifest", async () => {
      const epub = makeEpub(["ch1"], {
        ch1: { href: "text/chapter-1.xhtml", properties: "" },
      });
      const zip = makeZip({});
      const toc = await parser.parse(zip, epub, opfDirectory);
      expect(toc).toEqual([]);
    });

    it("returns empty array when nav file is missing from zip", async () => {
      const epub = makeEpub(["ch1"], {
        ch1: { href: "text/chapter-1.xhtml", properties: "" },
        nav: { href: "toc.xhtml", properties: "nav" },
      });
      const zip = makeZip({}); // file not in zip
      const toc = await parser.parse(zip, epub, opfDirectory);
      expect(toc).toEqual([]);
    });

    it("returns empty array for NCX with empty navMap", async () => {
      const epub = makeEpub(["ch1"], {
        ch1: { href: "text/chapter-1.xhtml", properties: "" },
        ncx: { href: "toc.ncx", properties: "" },
      });
      const zip = makeZip({
        "epub/toc.ncx": `<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap></navMap></ncx>`,
      });
      const toc = await parser.parse(zip, epub, opfDirectory);
      expect(toc).toEqual([]);
    });
  });
});
