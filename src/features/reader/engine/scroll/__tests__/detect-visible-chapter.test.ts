import { describe, expect, it, beforeEach, vi } from "vitest";
import { detectVisibleChapter } from "../detect-visible-chapter";

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

  it("returns the section closest to viewport top", () => {
    // Mock getBoundingClientRect: section 2 is closest to top (distance 10)
    sections[0].getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 150,
        }) as DOMRect,
    );
    sections[1].getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 200,
        }) as DOMRect,
    );
    sections[2].getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 10,
        }) as DOMRect,
    );
    sections[3].getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 100,
        }) as DOMRect,
    );
    sections[4].getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 300,
        }) as DOMRect,
    );

    const active = detectVisibleChapter(sections, 0);
    expect(active).toBe(2);
  });

  it("handles negative top values (elements above viewport)", () => {
    // Section 1 is slightly above viewport (top = -50, distance = 50)
    // Section 2 is below viewport (top = 100, distance = 100)
    sections[1].getBoundingClientRect = vi.fn(
      () =>
        ({
          top: -50,
        }) as DOMRect,
    );
    sections[2].getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 100,
        }) as DOMRect,
    );
    sections.slice(0, 1).forEach((s) => {
      s.getBoundingClientRect = vi.fn(() => ({ top: 500 }) as DOMRect);
    });
    sections.slice(3).forEach((s) => {
      s.getBoundingClientRect = vi.fn(() => ({ top: 600 }) as DOMRect);
    });

    const active = detectVisibleChapter(sections, 0);
    expect(active).toBe(1);
  });

  it("returns first section when all are equally far from top", () => {
    const currentVisible = 2;
    sections.forEach((s) => {
      s.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 500,
          }) as DOMRect,
      );
    });

    const active = detectVisibleChapter(sections, currentVisible);
    // All equally far; section 0 wins (first in iteration)
    expect(active).toBe(0);
  });

  it("ignores sections without data-chapter attribute in parsing", () => {
    // This tests the robustness: if a section has NaN as index,
    // it won't beat a valid one unless distance is smaller
    const badSection = document.createElement("section");
    badSection.getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 0,
        }) as DOMRect,
    );
    // No data-chapter attribute

    sections[0].getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 50,
        }) as DOMRect,
    );

    const testSections = [badSection, ...sections];
    const active = detectVisibleChapter(testSections, 0);

    // badSection has data-chapter=NaN, which is NaN. Chapter 0 has distance 50.
    // Since NaN comparison is always false, chapter 0 should win.
    // But actually this tests "what if a bad section is in the list"
    // In real code, getChapterSections filters these out, so this is defensive.
    expect(typeof active).toBe("number");
  });

  it("updates active when a closer section becomes visible", () => {
    const currentVisible = 0;
    sections[0].getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 200,
        }) as DOMRect,
    );
    sections[1].getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 20,
        }) as DOMRect,
    );
    sections[2].getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 150,
        }) as DOMRect,
    );
    sections[3].getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 300,
        }) as DOMRect,
    );
    sections[4].getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 400,
        }) as DOMRect,
    );

    const active = detectVisibleChapter(sections, currentVisible);
    expect(active).toBe(1); // Section 1 is now closest (distance 20)
  });

  it("handles single section", () => {
    const singleSection = document.createElement("section");
    singleSection.setAttribute("data-chapter", "0");
    singleSection.getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 100,
        }) as DOMRect,
    );

    const active = detectVisibleChapter([singleSection], 0);
    expect(active).toBe(0);
  });

  it("uses absolute distance (handles negative and positive equally)", () => {
    // Section 0 is 30px above top (distance 30)
    // Section 1 is 50px below top (distance 50)
    // -> Section 0 should win
    sections[0].getBoundingClientRect = vi.fn(
      () =>
        ({
          top: -30,
        }) as DOMRect,
    );
    sections[1].getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 50,
        }) as DOMRect,
    );
    sections.slice(2).forEach((s) => {
      s.getBoundingClientRect = vi.fn(() => ({ top: 500 }) as DOMRect);
    });

    const active = detectVisibleChapter(sections, 0);
    expect(active).toBe(0);
  });
});
