import { describe, expect, it, beforeEach } from "vitest";
import { getChapterSections } from "../get-chapter-sections";

describe("getChapterSections", () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument("test");
  });

  it("returns empty array when no sections exist", () => {
    const sections = getChapterSections(doc);
    expect(sections).toEqual([]);
  });

  it("returns all sections with data-chapter attribute", () => {
    const section1 = doc.createElement("section");
    section1.setAttribute("data-chapter", "0");
    doc.body.appendChild(section1);

    const section2 = doc.createElement("section");
    section2.setAttribute("data-chapter", "1");
    doc.body.appendChild(section2);

    const sections = getChapterSections(doc);
    expect(sections).toHaveLength(2);
  });

  it("ignores sections without data-chapter attribute", () => {
    const withAttr = doc.createElement("section");
    withAttr.setAttribute("data-chapter", "0");
    doc.body.appendChild(withAttr);

    const withoutAttr = doc.createElement("section");
    doc.body.appendChild(withoutAttr);

    const sections = getChapterSections(doc);
    expect(sections).toHaveLength(1);
    expect(sections[0].getAttribute("data-chapter")).toBe("0");
  });

  it("returns sections sorted by chapter index", () => {
    // Insert in non-sequential order
    const section3 = doc.createElement("section");
    section3.setAttribute("data-chapter", "3");
    doc.body.appendChild(section3);

    const section1 = doc.createElement("section");
    section1.setAttribute("data-chapter", "1");
    doc.body.appendChild(section1);

    const section2 = doc.createElement("section");
    section2.setAttribute("data-chapter", "2");
    doc.body.appendChild(section2);

    const sections = getChapterSections(doc);
    expect(sections).toHaveLength(3);
    expect(sections[0].getAttribute("data-chapter")).toBe("1");
    expect(sections[1].getAttribute("data-chapter")).toBe("2");
    expect(sections[2].getAttribute("data-chapter")).toBe("3");
  });

  it("handles numeric indices with gaps correctly", () => {
    const section0 = doc.createElement("section");
    section0.setAttribute("data-chapter", "0");
    doc.body.appendChild(section0);

    const section5 = doc.createElement("section");
    section5.setAttribute("data-chapter", "5");
    doc.body.appendChild(section5);

    const section10 = doc.createElement("section");
    section10.setAttribute("data-chapter", "10");
    doc.body.appendChild(section10);

    const sections = getChapterSections(doc);
    expect(sections.map((s) => s.getAttribute("data-chapter"))).toEqual([
      "0",
      "5",
      "10",
    ]);
  });

  it("returns HTMLElement[] type", () => {
    const section = doc.createElement("section");
    section.setAttribute("data-chapter", "0");
    doc.body.appendChild(section);

    const sections = getChapterSections(doc);
    expect(sections[0] instanceof HTMLElement).toBe(true);
  });
});
