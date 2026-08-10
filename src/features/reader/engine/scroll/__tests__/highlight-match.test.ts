import { describe, it, expect } from "vitest";
import { highlightWordInSection } from "../highlight-match";

describe("highlightWordInSection", () => {
  it("wraps the first case-insensitive match in a mark element", () => {
    const section = document.createElement("section");
    section.innerHTML =
      "<p>the immense weight of Eternity seemed to settle</p>";
    document.body.appendChild(section);

    const mark = highlightWordInSection(section, "eternity");

    expect(mark).not.toBeNull();
    expect(mark?.tagName).toBe("MARK");
    expect(mark?.classList.contains("search-highlight")).toBe(true);
    expect(mark?.textContent).toBe("Eternity");
    expect(section.textContent).toBe(
      "the immense weight of Eternity seemed to settle",
    );
  });

  it("returns null when the word isn't found", () => {
    const section = document.createElement("section");
    section.innerHTML = "<p>no match here</p>";
    document.body.appendChild(section);

    expect(highlightWordInSection(section, "eternity")).toBeNull();
  });
});
