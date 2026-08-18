import { describe, expect, it, vi } from "vitest";
import {
  buildLibraryFilterSections,
  buildSortSection,
} from "../filter-sections";
import { DEFAULT_LIBRARY_FILTERS } from "../filter-books";

describe("buildSortSection", () => {
  it("builds a chips section wired to the given sort value and setter", () => {
    const onSortByChange = vi.fn();
    const section = buildSortSection("title", onSortByChange);

    expect(section.type).toBe("chips");
    expect(section.value).toBe("title");
    if (section.type === "chips") section.onChange("author");
    expect(onSortByChange).toHaveBeenCalledWith("author");
  });
});

describe("buildLibraryFilterSections", () => {
  it("omits the language section with fewer than 2 languages", () => {
    const sections = buildLibraryFilterSections(
      DEFAULT_LIBRARY_FILTERS,
      vi.fn(),
      ["en"],
    );
    expect(sections.some((s) => s.key === "language")).toBe(false);
  });

  it("includes the language section with 2+ languages", () => {
    const sections = buildLibraryFilterSections(
      DEFAULT_LIBRARY_FILTERS,
      vi.fn(),
      ["en", "fr"],
    );
    const language = sections.find((s) => s.key === "language");
    expect(language?.type).toBe("select");
  });

  it("wires the hideFinished switch section to the current filter value", () => {
    const sections = buildLibraryFilterSections(
      { ...DEFAULT_LIBRARY_FILTERS, hideFinished: false },
      vi.fn(),
      [],
    );
    const hideFinished = sections.find((s) => s.key === "hideFinished");
    expect(hideFinished?.type).toBe("switch");
    expect(
      hideFinished && hideFinished.type === "switch" && hideFinished.checked,
    ).toBe(false);
  });
});
