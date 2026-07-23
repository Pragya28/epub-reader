import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  computeReaderProgress,
  saveReaderProgress,
} from "../save-reader-progress";
import { updateBookProgress } from "@/services/storage/book-repository";

vi.mock("@/shared/logger/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      trace: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock("@/services/storage/book-repository", () => ({
  updateBookProgress: vi.fn(),
}));

function createSection({
  chapterIndex,
  offsetTop,
  sectionHeight,
}: {
  chapterIndex: number;
  offsetTop: number;
  sectionHeight: number;
}): HTMLElement {
  const doc = document.implementation.createHTMLDocument("test");
  const section = doc.createElement("section");
  section.setAttribute("data-chapter", String(chapterIndex));

  Object.defineProperty(section, "offsetTop", {
    value: offsetTop,
    configurable: true,
  });
  Object.defineProperty(section, "scrollHeight", {
    value: sectionHeight,
    configurable: true,
  });
  Object.defineProperty(section, "offsetHeight", {
    value: sectionHeight,
    configurable: true,
  });

  doc.body.appendChild(section);
  return section;
}

function createIframeDoc(
  section: HTMLElement | null,
  documentHeight?: number,
): Document {
  const doc = document.implementation.createHTMLDocument("test");
  if (section) doc.body.appendChild(section);

  if (documentHeight !== undefined) {
    Object.defineProperty(doc.documentElement, "scrollHeight", {
      value: documentHeight,
      configurable: true,
    });
  }

  return doc;
}

function createWin(scrollY: number, innerHeight = 800): Window {
  return { scrollY, innerHeight } as unknown as Window;
}

describe("computeReaderProgress", () => {
  it("returns scrollFraction 0 when the active chapter's section isn't mounted", () => {
    const iframeDoc = createIframeDoc(null);

    const progress = computeReaderProgress({
      iframeDoc,
      win: createWin(500),
      activeIndex: 2,
      totalChapters: 10,
    });

    expect(progress.scrollFraction).toBe(0);
    expect(progress.chapterIndex).toBe(2);
    expect(progress.totalChapters).toBe(10);
  });

  it("computes the fraction relative to the section's own height, not absolute scrollY", () => {
    const section = createSection({
      chapterIndex: 3,
      offsetTop: 100,
      sectionHeight: 200,
    });
    const iframeDoc = createIframeDoc(section);

    const progress = computeReaderProgress({
      iframeDoc,
      win: createWin(150), // 50px into a 200px-tall section starting at 100
      activeIndex: 3,
      totalChapters: 10,
    });

    expect(progress.scrollFraction).toBeCloseTo(0.25);
  });

  it("clamps scrollFraction to 0 when scrollY is above the section (e.g. mid-jump)", () => {
    const section = createSection({
      chapterIndex: 1,
      offsetTop: 500,
      sectionHeight: 200,
    });
    const iframeDoc = createIframeDoc(section);

    const progress = computeReaderProgress({
      iframeDoc,
      win: createWin(0),
      activeIndex: 1,
      totalChapters: 10,
    });

    expect(progress.scrollFraction).toBe(0);
  });

  it("clamps scrollFraction to 1 when scrollY is past the section's end", () => {
    const section = createSection({
      chapterIndex: 1,
      offsetTop: 0,
      sectionHeight: 200,
    });
    const iframeDoc = createIframeDoc(section);

    const progress = computeReaderProgress({
      iframeDoc,
      win: createWin(9999),
      activeIndex: 1,
      totalChapters: 10,
    });

    expect(progress.scrollFraction).toBe(1);
  });

  it("falls back to 0 fraction instead of dividing by zero when section has no height", () => {
    const section = createSection({
      chapterIndex: 0,
      offsetTop: 0,
      sectionHeight: 0,
    });
    const iframeDoc = createIframeDoc(section);

    const progress = computeReaderProgress({
      iframeDoc,
      win: createWin(50),
      activeIndex: 0,
      totalChapters: 5,
    });

    expect(Number.isFinite(progress.scrollFraction)).toBe(true);
  });

  it("derives percent from chapterIndex + in-chapter fraction over totalChapters", () => {
    const section = createSection({
      chapterIndex: 4,
      offsetTop: 0,
      sectionHeight: 100,
    });
    const iframeDoc = createIframeDoc(section);

    // chapter 4 (0-indexed), 50% through it, 10 total chapters
    // => (4 + 0.5) / 10 * 100 = 45%
    const progress = computeReaderProgress({
      iframeDoc,
      win: createWin(50),
      activeIndex: 4,
      totalChapters: 10,
    });

    expect(progress.percent).toBe(45);
  });

  it("never returns a percent above 100 even at the very end of the last chapter", () => {
    const section = createSection({
      chapterIndex: 9,
      offsetTop: 0,
      sectionHeight: 100,
    });
    const iframeDoc = createIframeDoc(section);

    const progress = computeReaderProgress({
      iframeDoc,
      win: createWin(100),
      activeIndex: 9,
      totalChapters: 10,
    });

    expect(progress.percent).toBeLessThanOrEqual(100);
  });

  it("returns percent 0 when totalChapters is 0, instead of NaN/Infinity", () => {
    const iframeDoc = createIframeDoc(null);

    const progress = computeReaderProgress({
      iframeDoc,
      win: createWin(0),
      activeIndex: 0,
      totalChapters: 0,
    });

    expect(progress.percent).toBe(0);
  });

  it("stamps updatedAt with a real timestamp", () => {
    const before = Date.now();
    const iframeDoc = createIframeDoc(null);

    const progress = computeReaderProgress({
      iframeDoc,
      win: createWin(0),
      activeIndex: 0,
      totalChapters: 10,
    });

    const after = Date.now();
    expect(progress.updatedAt).toBeGreaterThanOrEqual(before);
    expect(progress.updatedAt).toBeLessThanOrEqual(after);
  });

  it("detects atDocumentEnd when scrollY + viewport reaches the document's scrollHeight", () => {
    const section = createSection({
      chapterIndex: 0,
      offsetTop: 0,
      sectionHeight: 100,
    });
    // Document is 1000px tall; a 800px viewport scrolled to 200 reaches
    // exactly the bottom (200 + 800 = 1000).
    const iframeDoc = createIframeDoc(section, 1000);

    const progress = computeReaderProgress({
      iframeDoc,
      win: createWin(200, 800),
      activeIndex: 0,
      totalChapters: 10,
    });

    expect(progress.atDocumentEnd).toBe(true);
  });

  it("does not report atDocumentEnd while there's still room to scroll", () => {
    const section = createSection({
      chapterIndex: 0,
      offsetTop: 0,
      sectionHeight: 100,
    });
    const iframeDoc = createIframeDoc(section, 2000);

    const progress = computeReaderProgress({
      iframeDoc,
      win: createWin(200, 800), // 200 + 800 = 1000, well short of 2000
      activeIndex: 0,
      totalChapters: 10,
    });

    expect(progress.atDocumentEnd).toBe(false);
  });

  it("tolerates a few px of sub-pixel rounding when checking atDocumentEnd", () => {
    const section = createSection({
      chapterIndex: 0,
      offsetTop: 0,
      sectionHeight: 100,
    });
    const iframeDoc = createIframeDoc(section, 1000);

    const progress = computeReaderProgress({
      iframeDoc,
      // 2px short of the exact bottom — should still count as "at the end"
      win: createWin(198, 800),
      activeIndex: 0,
      totalChapters: 10,
    });

    expect(progress.atDocumentEnd).toBe(true);
  });

  it("reports percent 100 and scrollFraction 1 once atDocumentEnd is true, even on a short last chapter whose own section-relative fraction is nowhere near 1", () => {
    // The exact scenario atDocumentEnd exists for: a short final section
    // (e.g. a one-paragraph epilogue) where the browser can't scroll far
    // enough within that section for the section-relative math to ever
    // approach 1, even though the user is at the book's literal end.
    const section = createSection({
      chapterIndex: 4,
      offsetTop: 900,
      sectionHeight: 500, // section-relative fraction would be tiny here
    });
    const iframeDoc = createIframeDoc(section, 1000); // document ends at 1000

    const progress = computeReaderProgress({
      iframeDoc,
      win: createWin(200, 800), // 200 + 800 = 1000 = document end
      activeIndex: 4,
      totalChapters: 5,
    });

    expect(progress.atDocumentEnd).toBe(true);
    expect(progress.scrollFraction).toBe(1);
    expect(progress.percent).toBe(100);
  });
});

describe("saveReaderProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleProgress = {
    chapterIndex: 2,
    totalChapters: 10,
    scrollFraction: 0.5,
    atDocumentEnd: false,
    percent: 25,
    updatedAt: Date.now(),
  };

  it("persists progress via updateBookProgress", async () => {
    vi.mocked(updateBookProgress).mockResolvedValueOnce(undefined);

    await saveReaderProgress("book-1", sampleProgress);

    expect(updateBookProgress).toHaveBeenCalledWith("book-1", sampleProgress);
  });

  it("swallows errors instead of throwing (must never interrupt reading)", async () => {
    vi.mocked(updateBookProgress).mockRejectedValueOnce(
      new Error("IndexedDB is unavailable"),
    );

    await expect(
      saveReaderProgress("book-1", sampleProgress),
    ).resolves.toBeUndefined();
  });
});
