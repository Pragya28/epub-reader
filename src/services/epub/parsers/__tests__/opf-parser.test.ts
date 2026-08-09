import { describe, expect, it } from "vitest";
import { OpfParser } from "../opf-parser";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { EpubServiceImpl } from "../../epub.service";

describe("OpfParser", () => {
  const epubService = new EpubServiceImpl();
  const parser = new OpfParser();

  const parseXml = (xml: string): Document => {
    return new DOMParser().parseFromString(xml, "application/xml");
  };

  it("extracts metadata correctly", () => {
    const xml = `
      <package>
        <metadata>
          <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">
            Test Book
          </dc:title>

          <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">
            Test Author
          </dc:creator>

          <dc:language xmlns:dc="http://purl.org/dc/elements/1.1/">
            en
          </dc:language>
        </metadata>

        <manifest>
          <item
            id="chapter-1"
            href="text/chapter-1.xhtml"
            media-type="application/xhtml+xml"
          />
        </manifest>

        <spine>
          <itemref idref="chapter-1" />
        </spine>
      </package>
    `;

    const doc = parseXml(xml);

    const result = parser.parse(doc);

    expect(result.metadata.title).toBe("Test Book");
    expect(result.metadata.author).toBe("Test Author");
    expect(result.metadata.language).toBe("en");
  });

  it("extracts description when present", () => {
    const xml = `
      <package>
        <metadata>
          <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Test Book</dc:title>
          <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">Test Author</dc:creator>
          <dc:description xmlns:dc="http://purl.org/dc/elements/1.1/">
            A book about testing.
          </dc:description>
        </metadata>

        <manifest>
          <item
            id="chapter-1"
            href="text/chapter-1.xhtml"
            media-type="application/xhtml+xml"
          />
        </manifest>

        <spine>
          <itemref idref="chapter-1" />
        </spine>
      </package>
    `;

    const result = parser.parse(parseXml(xml));

    expect(result.metadata.description).toBe("A book about testing.");
  });

  it("strips HTML markup escaped inside the description text", () => {
    const xml = `
      <package>
        <metadata>
          <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Test Book</dc:title>
          <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">Test Author</dc:creator>
          <dc:description xmlns:dc="http://purl.org/dc/elements/1.1/">&lt;p&gt;A book about &lt;b&gt;testing&lt;/b&gt;.&lt;/p&gt;</dc:description>
        </metadata>

        <manifest>
          <item
            id="chapter-1"
            href="text/chapter-1.xhtml"
            media-type="application/xhtml+xml"
          />
        </manifest>

        <spine>
          <itemref idref="chapter-1" />
        </spine>
      </package>
    `;

    const result = parser.parse(parseXml(xml));

    expect(result.metadata.description).toBe("A book about testing.");
  });

  it("preserves paragraph breaks from escaped <p> tags in the description", () => {
    const xml = `
      <package>
        <metadata>
          <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Test Book</dc:title>
          <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">Test Author</dc:creator>
          <dc:description xmlns:dc="http://purl.org/dc/elements/1.1/">&lt;p&gt;First paragraph.&lt;/p&gt;&lt;p&gt;Second paragraph.&lt;/p&gt;</dc:description>
        </metadata>

        <manifest>
          <item
            id="chapter-1"
            href="text/chapter-1.xhtml"
            media-type="application/xhtml+xml"
          />
        </manifest>

        <spine>
          <itemref idref="chapter-1" />
        </spine>
      </package>
    `;

    const result = parser.parse(parseXml(xml));

    expect(result.metadata.description).toBe(
      "First paragraph.\n\nSecond paragraph.",
    );
  });

  it("returns null description when absent", () => {
    const xml = `
      <package>
        <metadata>
          <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Test Book</dc:title>
          <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">Test Author</dc:creator>
        </metadata>

        <manifest>
          <item
            id="chapter-1"
            href="text/chapter-1.xhtml"
            media-type="application/xhtml+xml"
          />
        </manifest>

        <spine>
          <itemref idref="chapter-1" />
        </spine>
      </package>
    `;

    const result = parser.parse(parseXml(xml));

    expect(result.metadata.description).toBeNull();
  });

  it("extracts manifest correctly", () => {
    const xml = `
      <package>
        <metadata />

        <manifest>
          <item
            id="chapter-1"
            href="text/chapter-1.xhtml"
            media-type="application/xhtml+xml"
          />

          <item
            id="style"
            href="styles/main.css"
            media-type="text/css"
          />
        </manifest>

        <spine>
          <itemref idref="chapter-1" />
        </spine>
      </package>
    `;

    const doc = parseXml(xml);

    const result = parser.parse(doc);

    expect(Object.keys(result.manifest)).toHaveLength(2);

    expect(result.manifest["chapter-1"]).toEqual({
      href: "text/chapter-1.xhtml",
      properties: "",
    });

    expect(result.manifest["style"]).toEqual({
      href: "styles/main.css",
      properties: "",
    });
  });

  it("extracts spine correctly", () => {
    const xml = `
      <package>
        <metadata />

        <manifest>
          <item
            id="chapter-1"
            href="chapter-1.xhtml"
            media-type="application/xhtml+xml"
          />

          <item
            id="chapter-2"
            href="chapter-2.xhtml"
            media-type="application/xhtml+xml"
          />
        </manifest>

        <spine>
          <itemref idref="chapter-1" />
          <itemref idref="chapter-2" />
        </spine>
      </package>
    `;

    const doc = parseXml(xml);

    const result = parser.parse(doc);

    expect(result.spine).toEqual(["chapter-1", "chapter-2"]);
  });

  it("maintains correct spine order", () => {
    const xml = `
      <package>
        <metadata />

        <manifest>
          <item
            id="intro"
            href="intro.xhtml"
            media-type="application/xhtml+xml"
          />

          <item
            id="chapter-1"
            href="chapter-1.xhtml"
            media-type="application/xhtml+xml"
          />

          <item
            id="chapter-2"
            href="chapter-2.xhtml"
            media-type="application/xhtml+xml"
          />
        </manifest>

        <spine>
          <itemref idref="intro" />
          <itemref idref="chapter-1" />
          <itemref idref="chapter-2" />
        </spine>
      </package>
    `;

    const doc = parseXml(xml);

    const result = parser.parse(doc);
    expect(result.spine).toEqual(["intro", "chapter-1", "chapter-2"]);
  });

  it("handles missing metadata safely", () => {
    const xml = `
      <package>
        <metadata />

        <manifest>
          <item
            id="chapter-1"
            href="chapter-1.xhtml"
            media-type="application/xhtml+xml"
          />
        </manifest>

        <spine>
          <itemref idref="chapter-1" />
        </spine>
      </package>
    `;

    const doc = parseXml(xml);

    const result = parser.parse(doc);

    expect(result.metadata.title).toBe("Not Available");
    expect(result.metadata.author).toBe("Unknown");
    expect(result.metadata.language).toBe(null);
  });

  it("throws for empty manifest", () => {
    const xml = `
    <package>
      <metadata />
      <manifest />
      <spine />
    </package>
  `;

    const doc = parseXml(xml);

    expect(() => parser.parse(doc)).toThrow("manifest is empty");
  });

  it("throws for empty spine", () => {
    const xml = `
    <package>
      <metadata />

      <manifest>
        <item
          id="chapter-1"
          href="chapter-1.xhtml"
          media-type="application/xhtml+xml"
        />
      </manifest>

      <spine />
    </package>
  `;

    const doc = parseXml(xml);

    expect(() => parser.parse(doc)).toThrow("spine is empty");
  });

  it("throws when spine itemrefs have no idref", () => {
    const xml = `
    <package>
      <metadata />

      <manifest>
        <item
          id="chapter-1"
          href="chapter-1.xhtml"
          media-type="application/xhtml+xml"
        />
      </manifest>

      <spine>
        <itemref />
      </spine>
    </package>
  `;

    const doc = parseXml(xml);

    expect(() => parser.parse(doc)).toThrow("spine itemref missing idref");
  });

  it("throws for invalid spine references", async () => {
    const file = await loadFixture("broken-spine.epub");

    const { opfXml } = await epubService.extractOpf(file);

    expect(() => parser.parse(opfXml)).toThrow(
      "Invalid spine reference: missing-chapter",
    );
  });

  it("detects cover using cover-image property", () => {
    const xml = `
    <package>
      <metadata />

      <manifest>
        <item
          id="cover"
          href="images/cover.jpg"
          media-type="image/jpeg"
          properties="cover-image"
        />

        <item
          id="chapter-1"
          href="chapter-1.xhtml"
          media-type="application/xhtml+xml"
        />
      </manifest>

      <spine>
        <itemref idref="chapter-1" />
      </spine>
    </package>
  `;

    const doc = parseXml(xml);

    const result = parser.parse(doc);

    expect(result.coverItem).toEqual({
      href: "images/cover.jpg",
      properties: "cover-image",
    });
  });

  it("detects cover using metadata cover reference", () => {
    const xml = `
    <package>
      <metadata>
        <meta
          name="cover"
          content="cover-image"
        />
      </metadata>

      <manifest>
        <item
          id="cover-image"
          href="cover.jpg"
          media-type="image/jpeg"
        />

        <item
          id="chapter-1"
          href="chapter-1.xhtml"
          media-type="application/xhtml+xml"
        />
      </manifest>

      <spine>
        <itemref idref="chapter-1" />
      </spine>
    </package>
  `;

    const doc = parseXml(xml);

    const result = parser.parse(doc);

    expect(result.coverItem).toEqual({
      href: "cover.jpg",
      properties: "",
    });
  });

  it("falls back to manifest item containing cover in href", () => {
    const xml = `
    <package>
      <metadata />

      <manifest>
        <item
          id="image"
          href="Images/Cover.jpeg"
          media-type="image/jpeg"
        />

        <item
          id="chapter-1"
          href="chapter-1.xhtml"
          media-type="application/xhtml+xml"
        />
      </manifest>

      <spine>
        <itemref idref="chapter-1" />
      </spine>
    </package>
  `;

    const doc = parseXml(xml);

    const result = parser.parse(doc);

    expect(result.coverItem).toEqual({
      href: "Images/Cover.jpeg",
      properties: "",
    });
  });

  it("returns undefined when no cover exists", () => {
    const xml = `
    <package>
      <metadata />

      <manifest>
        <item
          id="chapter-1"
          href="chapter-1.xhtml"
          media-type="application/xhtml+xml"
        />

        <item
          id="style"
          href="style.css"
          media-type="text/css"
        />
      </manifest>

      <spine>
        <itemref idref="chapter-1" />
      </spine>
    </package>
  `;

    const doc = parseXml(xml);

    const result = parser.parse(doc);

    expect(result.coverItem).toBeUndefined();
  });
});
