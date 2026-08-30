import { describe, expect, it, beforeEach, vi } from "vitest";
import { detectVisibleChapter } from "../detect-visible-chapter";

/** Mock a section rect: `top` px from the viewport top, `height` px tall. */
const rect = (top: number, height = 1000) =>
  vi.fn(() => ({ top, bottom: top + height }) as DOMRect);

describe("detectVisibleChapter", () => {
  let sections: HTMLElement[];

  beforeEach(() => {
    sections = [];
    for (let i = 0; i < 5; i++) {
      const section = document.createElement("section");
      section.setAttribute("data-chapter", String(i));
      sections.push(section);
    }
  });

  it("returns the section covering the top of the viewport", () => {
    sections[0].getBoundingClientRect = rect(-2400);
    sections[1].getBoundingClientRect = rect(-1400);
    sections[2].getBoundingClientRect = rect(-400); // covers y=0
    sections[3].getBoundingClientRect = rect(600);
    sections[4].getBoundingClientRect = rect(1600);

    expect(detectVisibleChapter(sections, 0)).toBe(2);
  });

  it("stays on the current chapter while it still fills the viewport past its midpoint", () => {
    // Chapter 1 is 3000px tall, scrolled ~53% in: its top is -1600 but its
    // bottom (1400) is still well below the viewport top, so it stays active
    // even though chapter 2's top edge is closer to y=0.
    sections[0].getBoundingClientRect = rect(-4600, 3000);
    sections[1].getBoundingClientRect = rect(-1600, 3000);
    sections[2].getBoundingClientRect = rect(1400, 3000);
    sections[3].getBoundingClientRect = rect(4400, 3000);
    sections[4].getBoundingClientRect = rect(7400, 3000);

    expect(detectVisibleChapter(sections, 1)).toBe(1);
  });

  it("advances only once the next chapter's top reaches the viewport top", () => {
    sections[0].getBoundingClientRect = rect(-3000, 3000);
    sections[1].getBoundingClientRect = rect(0, 3000);
    sections[2].getBoundingClientRect = rect(3000, 3000);
    sections[3].getBoundingClientRect = rect(6000, 3000);
    sections[4].getBoundingClientRect = rect(9000, 3000);

    expect(detectVisibleChapter(sections, 0)).toBe(1);
  });

  it("falls back to the nearest upcoming section when none covers the viewport top", () => {
    // e.g. scrolled above chapter 0 — every section is below the viewport top.
    sections[0].getBoundingClientRect = rect(120);
    sections[1].getBoundingClientRect = rect(1120);
    sections[2].getBoundingClientRect = rect(2120);
    sections[3].getBoundingClientRect = rect(3120);
    sections[4].getBoundingClientRect = rect(4120);

    expect(detectVisibleChapter(sections, 3)).toBe(0);
  });

  it("handles a single section", () => {
    const only = document.createElement("section");
    only.setAttribute("data-chapter", "0");
    only.getBoundingClientRect = rect(-50, 1000);

    expect(detectVisibleChapter([only], 0)).toBe(0);
  });

  it("ignores sections without a data-chapter attribute", () => {
    const bad = document.createElement("section");
    // Covers the viewport top, but has no data-chapter — must be skipped, not
    // returned as chapter 0 (Number(null) === 0).
    bad.getBoundingClientRect = rect(-10, 1000);
    sections[0].getBoundingClientRect = rect(120);

    const active = detectVisibleChapter([bad, sections[0]], 0);
    expect(active).toBe(0);
  });
});
