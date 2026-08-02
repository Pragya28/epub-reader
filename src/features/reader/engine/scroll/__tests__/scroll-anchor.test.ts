import { describe, expect, it, vi } from "vitest";
import { computeScrollAnchor, resolveScrollAnchor } from "../scroll-anchor";

/** Stubs getBoundingClientRect on an element with a given `bottom`. */
function stubRectBottom(el: HTMLElement, bottom: number) {
  el.getBoundingClientRect = vi.fn(() => ({ bottom }) as DOMRect);
}

describe("computeScrollAnchor", () => {
  it("returns null when there are no candidate elements", () => {
    const section = document.createElement("section");
    section.innerHTML = `<div>no paragraphs here</div>`;

    expect(computeScrollAnchor(section)).toBeNull();
  });

  it("returns null when every candidate has already scrolled past the top", () => {
    const section = document.createElement("section");
    section.innerHTML = `<p>one</p><p>two</p>`;
    const [p1, p2] = section.querySelectorAll("p");
    stubRectBottom(p1 as HTMLElement, -10);
    stubRectBottom(p2 as HTMLElement, -5);

    expect(computeScrollAnchor(section)).toBeNull();
  });

  it("picks the first candidate not yet fully scrolled past the top", () => {
    const section = document.createElement("section");
    section.innerHTML = `<p>one</p><p>two</p><p>three</p>`;
    const [p1, p2, p3] = section.querySelectorAll("p");
    stubRectBottom(p1 as HTMLElement, -10); // scrolled past
    stubRectBottom(p2 as HTMLElement, 20); // this one
    stubRectBottom(p3 as HTMLElement, 100);

    const path = computeScrollAnchor(section);

    expect(path).not.toBeNull();
    expect(resolveScrollAnchor(section, path!)).toBe(p2);
  });

  it("records a path through nested wrapper elements", () => {
    const section = document.createElement("section");
    section.innerHTML = `<div><div><p>one</p><p>two</p></div></div>`;
    const target = section.querySelectorAll("p")[1] as HTMLElement;
    stubRectBottom(target, 20);

    const path = computeScrollAnchor(section);

    expect(path).not.toBeNull();
    expect(resolveScrollAnchor(section, path!)).toBe(target);
  });
});

describe("resolveScrollAnchor", () => {
  it("resolves a valid path back to the same element", () => {
    const section = document.createElement("section");
    section.innerHTML = `<p>a</p><p>b</p><p>c</p>`;
    const target = section.children[1];

    expect(resolveScrollAnchor(section, [1])).toBe(target);
  });

  it("returns null when a path index is out of bounds (structure changed)", () => {
    const section = document.createElement("section");
    section.innerHTML = `<p>a</p>`;

    expect(resolveScrollAnchor(section, [5])).toBeNull();
  });

  it("returns null for an empty path (would resolve to the section itself)", () => {
    const section = document.createElement("section");
    section.innerHTML = `<p>a</p>`;

    expect(resolveScrollAnchor(section, [])).toBeNull();
  });
});
