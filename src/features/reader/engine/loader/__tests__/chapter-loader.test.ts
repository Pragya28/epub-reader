import { describe, expect, it } from "vitest";
import { ChapterLoader } from "../chapter-loader";

describe("ChapterLoader", () => {
  describe("getLoadPlan", () => {
    it("loads a window centered on the current chapter", () => {
      const loader = new ChapterLoader();

      const plan = loader.getLoadPlan(5, 20, new Set());

      expect(plan.toLoad).toEqual([3, 4, 5, 6, 7]);
      expect(plan.toUnload).toEqual([]);
    });

    it("clamps the window at the start of the book", () => {
      const loader = new ChapterLoader();

      const plan = loader.getLoadPlan(0, 20, new Set());

      expect(plan.toLoad).toEqual([0, 1, 2]);
    });

    it("clamps the window at the end of the book", () => {
      const loader = new ChapterLoader();

      const plan = loader.getLoadPlan(19, 20, new Set());

      expect(plan.toLoad).toEqual([17, 18, 19]);
    });

    it("only returns indices not already loaded", () => {
      const loader = new ChapterLoader();

      const plan = loader.getLoadPlan(5, 20, new Set([3, 4, 5]));

      expect(plan.toLoad).toEqual([6, 7]);
    });

    it("marks out-of-window loaded chapters for unload", () => {
      const loader = new ChapterLoader();

      const plan = loader.getLoadPlan(10, 20, new Set([3, 4, 5, 9, 10, 11]));

      expect(plan.toUnload.sort()).toEqual([3, 4, 5]);
    });

    it("respects a custom window radius", () => {
      const loader = new ChapterLoader(1);

      const plan = loader.getLoadPlan(10, 20, new Set());

      expect(plan.toLoad).toEqual([9, 10, 11]);
    });

    it("handles a book with zero chapters", () => {
      const loader = new ChapterLoader();

      const plan = loader.getLoadPlan(0, 0, new Set([0, 1]));

      expect(plan.toLoad).toEqual([]);
      expect(plan.toUnload).toEqual([0, 1]);
    });
  });

  describe("hasNextChapter / hasPreviousChapter", () => {
    it("reports next/previous availability at book boundaries", () => {
      const loader = new ChapterLoader();

      expect(loader.hasNextChapter(0, 5)).toBe(true);
      expect(loader.hasNextChapter(4, 5)).toBe(false);
      expect(loader.hasPreviousChapter(0)).toBe(false);
      expect(loader.hasPreviousChapter(1)).toBe(true);
    });
  });
});
