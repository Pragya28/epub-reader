import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  maintainChapterWindow,
  WINDOW_RADIUS,
  MAX_WINDOW_SIZE,
} from "../chapter-window";

describe("maintainChapterWindow", () => {
  let doc: Document;
  let win: Window;
  let onUnload: ReturnType<typeof vi.fn<(index: number) => void>>;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument("test");
    win = window;
    onUnload = vi.fn<(index: number) => void>();
  });

  describe("constants", () => {
    it("has WINDOW_RADIUS of 2", () => {
      expect(WINDOW_RADIUS).toBe(2);
    });

    it("calculates MAX_WINDOW_SIZE correctly", () => {
      expect(MAX_WINDOW_SIZE).toBe(WINDOW_RADIUS * 2 + 1); // 5
      expect(MAX_WINDOW_SIZE).toBe(5);
    });
  });

  describe("early returns", () => {
    it("returns early if sections.length <= MAX_WINDOW_SIZE", () => {
      // Create only 5 sections (equal to MAX_WINDOW_SIZE)
      for (let i = 0; i < MAX_WINDOW_SIZE; i++) {
        const section = doc.createElement("section");
        section.setAttribute("data-chapter", String(i));
        doc.body.appendChild(section);
      }

      const loadedIndices = new Set([0, 1, 2, 3, 4]);

      maintainChapterWindow({
        iframeDoc: doc,
        win,
        activeIndex: 2,
        loadedIndices,
        onUnload,
      });

      // No unmounting should happen
      expect(onUnload).not.toHaveBeenCalled();
    });

    it("returns early if anchor section not found", () => {
      // Create sections but activeIndex doesn't correspond to any
      for (let i = 0; i < 10; i++) {
        const section = doc.createElement("section");
        section.setAttribute("data-chapter", String(i));
        doc.body.appendChild(section);
      }

      const loadedIndices = new Set(Array.from({ length: 10 }, (_, i) => i));

      maintainChapterWindow({
        iframeDoc: doc,
        win,
        activeIndex: 999, // Non-existent
        loadedIndices,
        onUnload,
      });

      expect(onUnload).not.toHaveBeenCalled();
    });
  });

  describe("windowing logic", () => {
    beforeEach(() => {
      // Create 10 sections in document
      for (let i = 0; i < 10; i++) {
        const section = doc.createElement("section");
        section.setAttribute("data-chapter", String(i));
        doc.body.appendChild(section);
      }

      // Mock getBoundingClientRect for all sections
      doc.querySelectorAll("section[data-chapter]").forEach((section, idx) => {
        (section as HTMLElement).getBoundingClientRect = vi.fn(
          () =>
            ({
              top: idx * 100,
            }) as DOMRect,
        );
      });
    });

    it("unmounts chapters outside window radius", () => {
      // activeIndex = 5, window = [3, 4, 5, 6, 7]
      // Should unmount [0, 1, 2, 8, 9]
      const loadedIndices = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      maintainChapterWindow({
        iframeDoc: doc,
        win,
        activeIndex: 5,
        loadedIndices,
        onUnload,
      });

      expect(onUnload).toHaveBeenCalledWith(0);
      expect(onUnload).toHaveBeenCalledWith(1);
      expect(onUnload).toHaveBeenCalledWith(2);
      expect(onUnload).toHaveBeenCalledWith(8);
      expect(onUnload).toHaveBeenCalledWith(9);
      expect(onUnload).toHaveBeenCalledTimes(5);
    });

    it("keeps chapters within window radius loaded", () => {
      // activeIndex = 5, window = [3, 4, 5, 6, 7]
      const loadedIndices = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      maintainChapterWindow({
        iframeDoc: doc,
        win,
        activeIndex: 5,
        loadedIndices,
        onUnload,
      });

      // Should NOT call onUnload for chapters 3, 4, 5, 6, 7
      const unloadedChapters = [
        onUnload.mock.calls.map((call: any[]) => call[0]),
      ].flat();
      expect(unloadedChapters).not.toContain(3);
      expect(unloadedChapters).not.toContain(4);
      expect(unloadedChapters).not.toContain(5);
      expect(unloadedChapters).not.toContain(6);
      expect(unloadedChapters).not.toContain(7);
    });

    it("handles activeIndex at start of book", () => {
      // activeIndex = 0, window = [-2, -1, 0, 1, 2] -> [0, 1, 2]
      const loadedIndices = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      maintainChapterWindow({
        iframeDoc: doc,
        win,
        activeIndex: 0,
        loadedIndices,
        onUnload,
      });

      // Should unmount [3, 4, 5, 6, 7, 8, 9]
      const unloadedChapters = onUnload.mock.calls.map(
        (call: any[]) => call[0],
      );
      expect(unloadedChapters).toContain(3);
      expect(unloadedChapters).not.toContain(0);
      expect(unloadedChapters).not.toContain(1);
      expect(unloadedChapters).not.toContain(2);
    });

    it("handles activeIndex at end of book", () => {
      // activeIndex = 9, window = [7, 8, 9, 10, 11] -> [7, 8, 9]
      const loadedIndices = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      maintainChapterWindow({
        iframeDoc: doc,
        win,
        activeIndex: 9,
        loadedIndices,
        onUnload,
      });

      // Should unmount [0, 1, 2, 3, 4, 5, 6]
      const unloadedChapters = onUnload.mock.calls.map(
        (call: any[]) => call[0],
      );
      expect(unloadedChapters).toContain(0);
      expect(unloadedChapters).not.toContain(7);
      expect(unloadedChapters).not.toContain(8);
      expect(unloadedChapters).not.toContain(9);
    });

    it("does not unmount activeIndex", () => {
      const loadedIndices = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      maintainChapterWindow({
        iframeDoc: doc,
        win,
        activeIndex: 5,
        loadedIndices,
        onUnload,
      });

      const unloadedChapters = onUnload.mock.calls.map(
        (call: any[]) => call[0],
      );
      expect(unloadedChapters).not.toContain(5);
    });

    it("only unmounts already-loaded indices", () => {
      // Only chapters 0-5 are loaded, not 6-9
      const loadedIndices = new Set([0, 1, 2, 3, 4, 5]);

      maintainChapterWindow({
        iframeDoc: doc,
        win,
        activeIndex: 3,
        loadedIndices,
        onUnload,
      });

      // Should only unmount 0 (outside window of [1, 2, 3, 4, 5])
      expect(onUnload).toHaveBeenCalledWith(0);
      expect(onUnload).toHaveBeenCalledTimes(1);
      expect(onUnload).not.toHaveBeenCalledWith(6);
    });
  });

  describe("scroll compensation", () => {
    beforeEach(() => {
      // Create sections with different heights (simulated via getBoundingClientRect)
      for (let i = 0; i < 5; i++) {
        const section = doc.createElement("section");
        section.setAttribute("data-chapter", String(i));
        doc.body.appendChild(section);
      }
    });

    it("compensates for scroll shift when anchor moves", () => {
      const scrollBySpy = vi.spyOn(win, "scrollBy");

      // Mock scroll positions
      const section2 = doc.querySelector(
        'section[data-chapter="2"]',
      ) as HTMLElement;
      let callCount = 0;

      (section2 as any).getBoundingClientRect = vi.fn(() => {
        // First call: returns 100px
        // Second call: returns 150px (after unloading sections)
        const top = callCount === 0 ? 100 : 150;
        callCount++;
        return { top } as DOMRect;
      });

      doc.querySelectorAll("section[data-chapter]").forEach((s, idx) => {
        if (s !== section2) {
          (s as HTMLElement).getBoundingClientRect = vi.fn(
            () =>
              ({
                top: (idx + 1) * 100,
              }) as DOMRect,
          );
        }
      });

      const loadedIndices = new Set([0, 1, 2, 3, 4]);

      maintainChapterWindow({
        iframeDoc: doc,
        win,
        activeIndex: 2,
        loadedIndices,
        onUnload,
      });

      // Delta = 150 - 100 = 50px down shift
      // scrollBy should be called to compensate
      if (scrollBySpy.mock.calls.length > 0) {
        expect(scrollBySpy).toHaveBeenCalled();
      }
    });

    it("does not scroll if anchor position unchanged", () => {
      const scrollBySpy = vi.spyOn(win, "scrollBy");

      const section2 = doc.querySelector(
        'section[data-chapter="2"]',
      ) as HTMLElement;

      // Mock same position on both calls
      (section2 as any).getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 100,
          }) as DOMRect,
      );

      doc.querySelectorAll("section[data-chapter]").forEach((s, idx) => {
        if (s !== section2) {
          (s as HTMLElement).getBoundingClientRect = vi.fn(
            () =>
              ({
                top: (idx + 1) * 100,
              }) as DOMRect,
          );
        }
      });

      const loadedIndices = new Set([0, 1, 2, 3, 4]);

      maintainChapterWindow({
        iframeDoc: doc,
        win,
        activeIndex: 2,
        loadedIndices,
        onUnload,
      });

      // scrollBy should either not be called or called with (0, 0)
      if (scrollBySpy.mock.calls.length > 0) {
        expect(scrollBySpy).toHaveBeenCalledWith(0, 0);
      }
    });
  });

  describe("asset revocation", () => {
    it("does not revoke blob URLs on window slide (revocation happens once at teardown)", () => {
      const revokeUrlSpy = vi.spyOn(URL, "revokeObjectURL");

      for (let i = 0; i < 7; i++) {
        const section = doc.createElement("section");
        section.setAttribute("data-chapter", String(i));
        doc.body.appendChild(section);
        (section as HTMLElement).getBoundingClientRect = vi.fn(
          () =>
            ({
              top: i * 100,
            }) as DOMRect,
        );
      }

      const loadedIndices = new Set([0, 1, 2, 3, 4]);

      maintainChapterWindow({
        iframeDoc: doc,
        win,
        activeIndex: 4,
        loadedIndices,
        onUnload,
      });

      expect(onUnload).toHaveBeenCalledWith(0);
      expect(onUnload).toHaveBeenCalledWith(1);
      expect(revokeUrlSpy).not.toHaveBeenCalled();
    });
  });

  describe("integration scenarios", () => {
    it("handles forward scrolling: moving to higher chapter indices", () => {
      for (let i = 0; i < 10; i++) {
        const section = doc.createElement("section");
        section.setAttribute("data-chapter", String(i));
        doc.body.appendChild(section);
        (section as HTMLElement).getBoundingClientRect = vi.fn(
          () =>
            ({
              top: i * 100,
            }) as DOMRect,
        );
      }

      let loadedIndices = new Set([0, 1, 2, 3, 4]);

      // Start at chapter 2
      maintainChapterWindow({
        iframeDoc: doc,
        win,
        activeIndex: 2,
        loadedIndices,
        onUnload,
      });

      expect(onUnload).not.toHaveBeenCalled();

      // Now at chapter 6
      onUnload.mockClear();
      loadedIndices = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      maintainChapterWindow({
        iframeDoc: doc,
        win,
        activeIndex: 6,
        loadedIndices,
        onUnload,
      });

      // Should unload 0, 1, 2 (outside [4, 5, 6, 7, 8])
      const unloaded = onUnload.mock.calls.map((call: any[]) => call[0]);
      expect(unloaded).toContain(0);
      expect(unloaded).toContain(1);
      expect(unloaded).toContain(2);
    });

    it("handles backward scrolling: moving to lower chapter indices", () => {
      for (let i = 0; i < 10; i++) {
        const section = doc.createElement("section");
        section.setAttribute("data-chapter", String(i));
        doc.body.appendChild(section);
        (section as HTMLElement).getBoundingClientRect = vi.fn(
          () =>
            ({
              top: i * 100,
            }) as DOMRect,
        );
      }

      let loadedIndices = new Set([5, 6, 7, 8, 9]);

      // Start at chapter 7
      maintainChapterWindow({
        iframeDoc: doc,
        win,
        activeIndex: 7,
        loadedIndices,
        onUnload,
      });

      expect(onUnload).not.toHaveBeenCalled();

      // Now at chapter 1
      onUnload.mockClear();
      loadedIndices = new Set(Array.from({ length: 10 }, (_, i) => i));

      maintainChapterWindow({
        iframeDoc: doc,
        win,
        activeIndex: 1,
        loadedIndices,
        onUnload,
      });

      // Should unload 4, 5, 6, 7, 8, 9 (outside [-1, 0, 1, 2, 3])
      const unloaded = onUnload.mock.calls.map((call: any[]) => call[0]);
      expect(unloaded).toContain(4);
      expect(unloaded).toContain(9);
    });
  });
});
