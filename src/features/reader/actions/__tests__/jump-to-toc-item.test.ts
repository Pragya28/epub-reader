import { beforeEach, describe, expect, it, vi } from "vitest";
import { jumpToTocItem } from "../jump-to-toc-item";
import { readerStore } from "../../store/reader-store";
import * as chapterRendererModule from "../../engine/renderer/chapter-renderer";
import type { TocItem, ParsedChapter } from "@/services/epub/epub-types";

vi.mock("@/shared/logger/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock("../../engine/renderer/chapter-renderer", () => ({
  mountChapter: vi.fn(),
}));

const createChapter = (index: number): ParsedChapter => ({
  id: `ch${index}`,
  href: `text/ch${index}.xhtml`,
  content: `<p>Chapter ${index}</p>`,
  stylesheets: [],
  assetMap: new Map(),
});

const createTocItem = (chapterIndex: number, fragmentId?: string): TocItem => ({
  label: `Chapter ${chapterIndex}`,
  href: `text/ch${chapterIndex}.xhtml${fragmentId ? `#${fragmentId}` : ""}`,
  chapterIndex,
  fragmentId,
  children: [],
});

describe("jumpToTocItem", () => {
  let doc: Document;
  let win: { scrollTo: ReturnType<typeof vi.fn> };
  let chapters: ParsedChapter[];

  beforeEach(() => {
    readerStore.getState().reset();
    vi.clearAllMocks();

    doc = document.implementation.createHTMLDocument("test");

    win = { scrollTo: vi.fn() };

    chapters = Array.from({ length: 5 }, (_, i) => createChapter(i));
  });

  // Helper: insert a <section data-chapter="N"> into doc with a given offsetTop.
  // jsdom doesn't do layout so offsetTop is always 0 — we override it directly.
  const mountSection = (chapterIndex: number, offsetTop = 0): HTMLElement => {
    const section = doc.createElement("section");
    section.setAttribute("data-chapter", String(chapterIndex));
    Object.defineProperty(section, "offsetTop", {
      value: offsetTop,
      configurable: true,
    });
    doc.body.appendChild(section);
    return section;
  };

  const mountFragment = (
    section: HTMLElement,
    id: string,
    offsetTop = 0,
  ): HTMLElement => {
    const el = doc.createElement("span");
    el.id = id;
    Object.defineProperty(el, "offsetTop", {
      value: offsetTop,
      configurable: true,
    });
    section.appendChild(el);
    return el;
  };

  describe("range guard", () => {
    it("does nothing when chapterIndex is -1", () => {
      jumpToTocItem(createTocItem(-1), doc, win as any, chapters);

      expect(win.scrollTo).not.toHaveBeenCalled();
      expect(readerStore.getState().isJumping).toBe(false);
    });

    it("does nothing when chapterIndex equals chapters.length", () => {
      jumpToTocItem(createTocItem(chapters.length), doc, win as any, chapters);

      expect(win.scrollTo).not.toHaveBeenCalled();
      expect(readerStore.getState().isJumping).toBe(false);
    });

    it("does nothing when chapterIndex exceeds chapters.length", () => {
      jumpToTocItem(createTocItem(99), doc, win as any, chapters);

      expect(win.scrollTo).not.toHaveBeenCalled();
    });
  });

  describe("chapter mounting", () => {
    it("mounts the chapter when it is not yet loaded", () => {
      mountSection(2);

      jumpToTocItem(createTocItem(2), doc, win as any, chapters);

      expect(chapterRendererModule.mountChapter).toHaveBeenCalledWith(
        doc,
        chapters[2],
        2,
      );
    });

    it("adds the chapter index to loadedChapterIndices after mounting", () => {
      mountSection(2);

      jumpToTocItem(createTocItem(2), doc, win as any, chapters);

      expect(readerStore.getState().loadedChapterIndices.has(2)).toBe(true);
    });

    it("does not call mountChapter when chapter is already loaded", () => {
      readerStore.getState().addLoadedChapterIndex(1);
      mountSection(1);

      jumpToTocItem(createTocItem(1), doc, win as any, chapters);

      expect(chapterRendererModule.mountChapter).not.toHaveBeenCalled();
    });

    it("clears isMountingChapter after a successful mount", () => {
      mountSection(0);

      jumpToTocItem(createTocItem(0), doc, win as any, chapters);

      expect(readerStore.getState().isMountingChapter).toBe(false);
    });
  });

  describe("scroll target — no fragment", () => {
    it("scrolls to section offsetTop when no fragmentId", () => {
      mountSection(1, 400);
      readerStore.getState().addLoadedChapterIndex(1);

      jumpToTocItem(createTocItem(1), doc, win as any, chapters);

      expect(win.scrollTo).toHaveBeenCalledWith(0, 400);
    });

    it("scrolls to 0 when section is at the top", () => {
      mountSection(0, 0);
      readerStore.getState().addLoadedChapterIndex(0);

      jumpToTocItem(createTocItem(0), doc, win as any, chapters);

      expect(win.scrollTo).toHaveBeenCalledWith(0, 0);
    });
  });

  describe("scroll target — with fragment", () => {
    it("scrolls to section.offsetTop + fragmentEl.offsetTop when fragment found", () => {
      const section = mountSection(2, 300);
      mountFragment(section, "section-1", 150);
      readerStore.getState().addLoadedChapterIndex(2);

      jumpToTocItem(createTocItem(2, "section-1"), doc, win as any, chapters);

      expect(win.scrollTo).toHaveBeenCalledWith(0, 450); // 300 + 150
    });

    it("falls back to section offsetTop when fragment element not found in DOM", () => {
      mountSection(2, 300);
      readerStore.getState().addLoadedChapterIndex(2);

      // fragmentId given but no element with that id exists
      jumpToTocItem(createTocItem(2, "missing-id"), doc, win as any, chapters);

      expect(win.scrollTo).toHaveBeenCalledWith(0, 300);
    });
  });

  describe("store updates", () => {
    it("sets isJumping to true before scrolling", () => {
      let isJumpingDuringScroll = false;

      win.scrollTo = vi.fn(() => {
        isJumpingDuringScroll = readerStore.getState().isJumping;
      });

      mountSection(0);

      jumpToTocItem(createTocItem(0), doc, win as any, chapters);

      expect(isJumpingDuringScroll).toBe(true);
    });

    it("releases isJumping on the next animation frame", () => {
      const rafCalls: FrameRequestCallback[] = [];
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        rafCalls.push(cb);
        return 1;
      });

      mountSection(0);

      jumpToTocItem(createTocItem(0), doc, win as any, chapters);

      // isJumping is true until rAF fires
      expect(readerStore.getState().isJumping).toBe(true);

      rafCalls.forEach((cb) => cb(0));

      expect(readerStore.getState().isJumping).toBe(false);

      vi.unstubAllGlobals();
    });

    it("updates currentChapterIndex in the store", () => {
      mountSection(3);

      jumpToTocItem(createTocItem(3), doc, win as any, chapters);

      expect(readerStore.getState().currentChapterIndex).toBe(3);
    });
  });

  describe("section not found after mount", () => {
    it("does not scroll when section is missing from DOM after mount", () => {
      // Chapter is in range but section was never inserted into doc
      jumpToTocItem(createTocItem(1), doc, win as any, chapters);

      expect(win.scrollTo).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("releases isJumping when mountChapter throws", () => {
      vi.mocked(chapterRendererModule.mountChapter).mockImplementation(() => {
        throw new Error("mount failed");
      });

      // No section in doc — but the throw happens before we reach scrollTo
      jumpToTocItem(createTocItem(0), doc, win as any, chapters);

      expect(readerStore.getState().isJumping).toBe(false);
    });

    it("does not propagate errors to the caller", () => {
      vi.mocked(chapterRendererModule.mountChapter).mockImplementation(() => {
        throw new Error("mount failed");
      });

      expect(() =>
        jumpToTocItem(createTocItem(0), doc, win as any, chapters),
      ).not.toThrow();
    });
  });
});
