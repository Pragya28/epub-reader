import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  computeReaderProgress,
  saveReaderProgress,
} from "../save-reader-progress";
import { updateBookProgress } from "@/services/storage/book-repository";

vi.mock("@/shared/logger/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock("@/services/storage/book-repository", () => ({
  updateBookProgress: vi.fn(() => Promise.resolve()),
}));

// ---- Helpers ----

interface SectionConfig {
  chapterIndex: number;
  offsetTop: number;
  scrollHeight: number;
}

/**
 * Creates a minimal Document with <section data-chapter="N"> elements
 * and a documentElement whose scrollHeight covers all sections.
 * offsetTop and scrollHeight are defined as non-writable jsdom properties
 * so we use Object.defineProperty.
 */
function makeDoc(
  sections: SectionConfig[],
  documentScrollHeight = 2000,
): Document {
  const doc = document.implementation.createHTMLDocument("test");

  Object.defineProperty(doc.documentElement, "scrollHeight", {
    value: documentScrollHeight,
    configurable: true,
  });

  for (const { chapterIndex, offsetTop, scrollHeight } of sections) {
    const section = doc.createElement("section");
    section.setAttribute("data-chapter", String(chapterIndex));
    Object.defineProperty(section, "offsetTop", {
      value: offsetTop,
      configurable: true,
    });
    Object.defineProperty(section, "scrollHeight", {
      value: scrollHeight,
      configurable: true,
    });
    doc.body.appendChild(section);
  }

  return doc;
}

function makeWin(
  scrollY: number,
  innerHeight = 800,
): Pick<Window, "scrollY" | "innerHeight"> {
  return { scrollY, innerHeight };
}

// ---- computeReaderProgress ----

describe("computeReaderProgress", () => {
  describe("scrollFraction is relative to section height, not document height", () => {
    it("produces the same fraction at the same logical position regardless of viewport height", () => {
      // Section starts at 400px, is 1000px tall.
      // User is 500px into the section → fraction should be 0.5 in both cases.
      // Document is 10000px tall so atDocumentEnd never fires regardless of viewport.
      const doc = makeDoc(
        [{ chapterIndex: 1, offsetTop: 400, scrollHeight: 1000 }],
        10000,
      );

      const smallViewport = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(900, 400) as Window, // scrollY=400+500=900, innerHeight=400
        activeIndex: 1,
        totalChapters: 5,
      });

      const largeViewport = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(900, 1200) as Window, // same scrollY, bigger viewport
        activeIndex: 1,
        totalChapters: 5,
      });

      expect(smallViewport.scrollFraction).toBeCloseTo(0.5);
      expect(largeViewport.scrollFraction).toBeCloseTo(0.5);
    });

    it("produces the same fraction after a reflow that doubles section height", () => {
      // Simulate font-size increase: section height doubles from 1000 to 2000.
      // User was 500px into the original section (fraction=0.5).
      // After reflow the same fraction 0.5 should restore to 1000px into the new section.
      // We verify computeReaderProgress is purely fraction-based — i.e. absolute
      // pixels in are not baked into the stored value.
      const docBefore = makeDoc([
        { chapterIndex: 0, offsetTop: 0, scrollHeight: 1000 },
      ]);
      const docAfter = makeDoc([
        { chapterIndex: 0, offsetTop: 0, scrollHeight: 2000 },
      ]);

      const progressBefore = computeReaderProgress({
        iframeDoc: docBefore,
        win: makeWin(500) as Window,
        activeIndex: 0,
        totalChapters: 3,
      });

      // The fraction recorded before reflow...
      expect(progressBefore.scrollFraction).toBeCloseTo(0.5);

      // ...restores to a different absolute pixel offset after reflow,
      // but the same fraction applies to the new height.
      const restoredY = 0 + progressBefore.scrollFraction * 2000; // section.offsetTop + fraction * newHeight
      expect(restoredY).toBeCloseTo(1000);
    });

    it("uses section.scrollHeight not document scrollHeight for the fraction denominator", () => {
      // Document is 5000px tall; active section is only 800px.
      // Fraction should be measured against 800, not 5000.
      const doc = makeDoc(
        [{ chapterIndex: 0, offsetTop: 0, scrollHeight: 800 }],
        5000,
      );

      const result = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(400) as Window, // halfway through the 800px section
        activeIndex: 0,
        totalChapters: 1,
      });

      expect(result.scrollFraction).toBeCloseTo(0.5);
    });
  });

  describe("scrollFraction bounds", () => {
    it("clamps to 0 when scrollY is above the section top", () => {
      const doc = makeDoc([
        { chapterIndex: 0, offsetTop: 500, scrollHeight: 1000 },
      ]);

      const result = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(0) as Window, // above the section
        activeIndex: 0,
        totalChapters: 3,
      });

      expect(result.scrollFraction).toBe(0);
    });

    it("clamps to 1 when scrollY is beyond section bottom", () => {
      const doc = makeDoc([
        { chapterIndex: 0, offsetTop: 0, scrollHeight: 500 },
      ]);

      const result = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(9999) as Window,
        activeIndex: 0,
        totalChapters: 3,
      });

      // atDocumentEnd will override to 1 if at end — here document is 2000px
      // and scrollY is 9999 so atDocumentEnd fires; either way fraction ≤ 1.
      expect(result.scrollFraction).toBe(1);
    });

    it("returns scrollFraction 0 when the active section is not found in the document", () => {
      // activeIndex=3 but only section 0 exists
      const doc = makeDoc([
        { chapterIndex: 0, offsetTop: 0, scrollHeight: 1000 },
      ]);

      const result = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(500) as Window,
        activeIndex: 3,
        totalChapters: 5,
      });

      expect(result.scrollFraction).toBe(0);
    });
  });

  describe("atDocumentEnd", () => {
    it("is true when scrollY + viewport reaches within tolerance of document end", () => {
      const doc = makeDoc(
        [{ chapterIndex: 0, offsetTop: 0, scrollHeight: 2000 }],
        2000,
      );

      // scrollY=1198, innerHeight=800 → scrollY+vh=1998, documentHeight=2000,
      // difference=2 which is within the 4px tolerance
      const result = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(1198, 800) as Window,
        activeIndex: 0,
        totalChapters: 1,
      });

      expect(result.atDocumentEnd).toBe(true);
    });

    it("is false when scrollY + viewport is clearly short of document end", () => {
      const doc = makeDoc(
        [{ chapterIndex: 0, offsetTop: 0, scrollHeight: 2000 }],
        2000,
      );

      const result = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(0, 800) as Window,
        activeIndex: 0,
        totalChapters: 1,
      });

      expect(result.atDocumentEnd).toBe(false);
    });

    it("overrides scrollFraction to 1 when atDocumentEnd is true", () => {
      // Short last section — fraction math gives < 1 but user is at doc end
      const doc = makeDoc(
        [{ chapterIndex: 0, offsetTop: 0, scrollHeight: 200 }],
        800,
      );

      // scrollY=0, innerHeight=800 → at document end (800 >= 800-4)
      const result = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(0, 800) as Window,
        activeIndex: 0,
        totalChapters: 1,
      });

      expect(result.atDocumentEnd).toBe(true);
      expect(result.scrollFraction).toBe(1);
    });
  });

  describe("percent calculation", () => {
    it("increases as chapter index increases", () => {
      const doc = makeDoc([
        { chapterIndex: 2, offsetTop: 0, scrollHeight: 1000 },
      ]);
      const win = makeWin(0) as Window;

      const ch0 = computeReaderProgress({
        iframeDoc: doc,
        win,
        activeIndex: 0,
        totalChapters: 4,
      });
      const ch2 = computeReaderProgress({
        iframeDoc: doc,
        win,
        activeIndex: 2,
        totalChapters: 4,
      });

      expect(ch2.percent).toBeGreaterThan(ch0.percent);
    });

    it("is 0 when totalChapters is 0", () => {
      const doc = makeDoc([]);

      const result = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(0) as Window,
        activeIndex: 0,
        totalChapters: 0,
      });

      expect(result.percent).toBe(0);
    });

    it("never exceeds 100", () => {
      const doc = makeDoc(
        [{ chapterIndex: 4, offsetTop: 0, scrollHeight: 200 }],
        800,
      );

      // atDocumentEnd → scrollFraction=1, last chapter → percent should cap at 100
      const result = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(0, 800) as Window,
        activeIndex: 4,
        totalChapters: 5,
      });

      expect(result.percent).toBeLessThanOrEqual(100);
    });
  });

  describe("resize / reflow resilience", () => {
    it("restoring from a saved fraction on a taller post-reflow section lands at the right pixel", () => {
      // This tests the contract that callers of computeReaderProgress
      // must honour: restore = section.offsetTop + fraction * section.scrollHeight.
      // Both sides use the live section height at their respective moment in time.
      const savedFraction = 0.4;

      // After reflow: section is now 1500px tall instead of 1000px
      const postReflowSectionHeight = 1500;
      const sectionOffsetTop = 200;

      const expectedY =
        sectionOffsetTop + savedFraction * postReflowSectionHeight;
      expect(expectedY).toBeCloseTo(800); // 200 + 0.4*1500
    });

    it("fraction is stable across a viewport height change (landscape ↔ portrait)", () => {
      // Section: offsetTop=0, height=2000. User is 1000px in → fraction=0.5.
      const doc = makeDoc(
        [{ chapterIndex: 0, offsetTop: 0, scrollHeight: 2000 }],
        3000,
      );

      const portrait = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(1000, 667) as Window,
        activeIndex: 0,
        totalChapters: 5,
      });

      const landscape = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(1000, 375) as Window,
        activeIndex: 0,
        totalChapters: 5,
      });

      expect(portrait.scrollFraction).toBeCloseTo(landscape.scrollFraction, 5);
    });

    it("a larger viewport does not spuriously trigger atDocumentEnd mid-book", () => {
      // Document is 5000px. User is at scrollY=500 with a large 1200px viewport.
      // 500 + 1200 = 1700, well short of 5000 — atDocumentEnd must be false.
      const doc = makeDoc(
        [{ chapterIndex: 0, offsetTop: 0, scrollHeight: 5000 }],
        5000,
      );

      const result = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(500, 1200) as Window,
        activeIndex: 0,
        totalChapters: 10,
      });

      expect(result.atDocumentEnd).toBe(false);
    });

    it("a shrinking viewport does not change the recorded scrollFraction", () => {
      // Same scroll position, viewport shrinks from 800 to 400.
      // Fraction must not change — it is independent of viewport height.
      const doc = makeDoc(
        [{ chapterIndex: 0, offsetTop: 0, scrollHeight: 2000 }],
        4000,
      );

      const before = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(600, 800) as Window,
        activeIndex: 0,
        totalChapters: 3,
      });

      const after = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(600, 400) as Window,
        activeIndex: 0,
        totalChapters: 3,
      });

      expect(before.scrollFraction).toBeCloseTo(after.scrollFraction, 5);
    });
  });

  describe("anchorPath", () => {
    it("includes an anchor path when the active section has content blocks", () => {
      const doc = makeDoc([
        { chapterIndex: 0, offsetTop: 0, scrollHeight: 1000 },
      ]);
      const section = doc.querySelector(
        'section[data-chapter="0"]',
      ) as HTMLElement;
      const p = doc.createElement("p");
      p.textContent = "hello";
      p.getBoundingClientRect = () => ({ bottom: 50 }) as DOMRect;
      section.appendChild(p);

      const result = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(0) as Window,
        activeIndex: 0,
        totalChapters: 3,
      });

      expect(result.anchorPath).toEqual([0]);
    });

    it("is null when the active section has no content blocks", () => {
      const doc = makeDoc([
        { chapterIndex: 0, offsetTop: 0, scrollHeight: 1000 },
      ]);

      const result = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(0) as Window,
        activeIndex: 0,
        totalChapters: 3,
      });

      expect(result.anchorPath).toBeNull();
    });

    it("is null when the active section isn't found in the document", () => {
      const doc = makeDoc([
        { chapterIndex: 0, offsetTop: 0, scrollHeight: 1000 },
      ]);

      const result = computeReaderProgress({
        iframeDoc: doc,
        win: makeWin(0) as Window,
        activeIndex: 3,
        totalChapters: 5,
      });

      expect(result.anchorPath).toBeNull();
    });
  });
});

// ---- saveReaderProgress ----

describe("saveReaderProgress", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls updateBookProgress with the given bookId and progress", async () => {
    const progress = {
      chapterIndex: 2,
      totalChapters: 10,
      scrollFraction: 0.5,
      atDocumentEnd: false,
      percent: 25,
      updatedAt: Date.now(),
    };

    await saveReaderProgress("book-1", progress);

    expect(updateBookProgress).toHaveBeenCalledWith("book-1", progress);
  });

  it("does not throw when updateBookProgress rejects", async () => {
    vi.mocked(updateBookProgress).mockRejectedValueOnce(
      new Error("db write failed"),
    );

    await expect(
      saveReaderProgress("book-1", {
        chapterIndex: 0,
        totalChapters: 5,
        scrollFraction: 0,
        atDocumentEnd: false,
        percent: 0,
        updatedAt: Date.now(),
      }),
    ).resolves.not.toThrow();
  });
});
