import { describe, expect, it } from "vitest";
import { isBookFinished } from "../is-book-finished";

describe("isBookFinished", () => {
  it("is false for an empty book", () => {
    expect(isBookFinished(0, 0, 100)).toBe(false);
  });

  it("is true near the end of the last chapter", () => {
    expect(isBookFinished(9, 10, 98)).toBe(true);
  });

  it("is false on the last chapter before the threshold", () => {
    expect(isBookFinished(9, 10, 97.9)).toBe(false);
  });

  it("is false mid-book even at a high percent below 100", () => {
    expect(isBookFinished(5, 10, 99)).toBe(false);
  });

  it("is true at 100% off the last chapter (tiny trailing chapter)", () => {
    expect(isBookFinished(16, 18, 100)).toBe(true);
  });
});
