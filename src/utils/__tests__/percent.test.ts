import { describe, expect, it } from "vitest";
import { clampPercent, toPercent } from "../percent";

describe("clampPercent", () => {
  it("passes through an in-range value unchanged", () => {
    expect(clampPercent(30.9)).toBe(30.9);
  });

  it("clamps a value above 100 (e.g. corrupted stored data)", () => {
    expect(clampPercent(3090)).toBe(100);
  });

  it("clamps a negative value to 0", () => {
    expect(clampPercent(-5)).toBe(0);
  });

  it("maps NaN to 0", () => {
    expect(clampPercent(NaN)).toBe(0);
  });

  it("maps Infinity to 0", () => {
    expect(clampPercent(Infinity)).toBe(0);
  });
});

describe("toPercent", () => {
  it("computes a ratio as a 0-100 percent", () => {
    expect(toPercent(1, 4)).toBe(25);
  });

  it("clamps a numerator larger than the denominator", () => {
    expect(toPercent(309, 10)).toBe(100);
  });

  it("rounds to the given number of decimals before clamping", () => {
    expect(toPercent(1, 3, 1)).toBe(33.3);
  });

  it("keeps the raw float when no decimals are given", () => {
    expect(toPercent(1, 3)).toBeCloseTo(33.333, 3);
  });

  it("returns 0 instead of NaN for a zero denominator", () => {
    expect(toPercent(5, 0)).toBe(0);
  });

  it("returns 0 for a negative denominator", () => {
    expect(toPercent(5, -10)).toBe(0);
  });
});
