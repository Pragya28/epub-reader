import { beforeEach, describe, expect, it, vi } from "vitest";
import { jumpToTocItem } from "../jump-to-toc-item";
import { readerStore } from "../../store/reader-store";
import * as chapterRendererModule from "../../engine/renderer/chapter-renderer";
import type {
  TocItem,
  ParsedBook,
  ParsedChapter,
} from "@/services/epub/epub-types";

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
  let win: {
    scrollTo: ReturnType<typeof vi.fn>;
    scrollY: number;
    dispatchEvent: ReturnType<typeof vi.fn>;
  };
  let chapters: ParsedChapter[];
  let parsedBook: ParsedBook;

  beforeEach(() => {
    readerStore.getState().reset();
    vi.clearAllMocks();

    doc = document.implementation.createHTMLDocument("test");

    win = { scrollTo: vi.fn(), scrollY: 0, dispatchEvent: vi.fn() };

    chapters = Array.from({ length: 5 }, (_, i) => createChapter(i));
    parsedBook = {
      metadata: {
        title: "Test",
        author: "Author",
        language: "en",
        description: null,
      },
      chapters,
      toc: [],
      stylesheets: [],
      loadChapter: vi.fn((index: number) => Promise.resolve(chapters[index]!)),
    };
  });

  // Helper: insert a <section data-chapter="N"> into doc with a given rect top.
  // jsdom doesn't do layout so getBoundingClientRect always returns 0s — we override it directly.
  const stubRectTop = (el: HTMLElement, top: number) => {
    el.getBoundingClientRect = () => ({ top }) as DOMRect;
  };

  const mountSection = (chapterIndex: number, top = 0): HTMLElement => {
    const section = doc.createElement("section");
    section.setAttribute("data-chapter", String(chapterIndex));
    stubRectTop(section, top);
    doc.body.appendChild(section);
    return section;
  };

  const mountFragment = (
    section: HTMLElement,
    id: string,
    top = 0,
  ): HTMLElement => {
    const el = doc.createElement("span");
    el.id = id;
    stubRectTop(el, top);
    section.appendChild(el);
    return el;
  };

  describe("range guard", () => {
    it("does nothing when chapterIndex is -1", async () => {
      await jumpToTocItem(createTocItem(-1), doc, win as any, parsedBook);

      expect(win.scrollTo).not.toHaveBeenCalled();
      expect(readerStore.getState().isJumping).toBe(false);
    });

    it("does nothing when chapterIndex equals chapters.length", async () => {
      await jumpToTocItem(
        createTocItem(chapters.length),
        doc,
        win as any,
        parsedBook,
      );

      expect(win.scrollTo).not.toHaveBeenCalled();
      expect(readerStore.getState().isJumping).toBe(false);
    });

    it("does nothing when chapterIndex exceeds chapters.length", async () => {
      await jumpToTocItem(createTocItem(99), doc, win as any, parsedBook);

      expect(win.scrollTo).not.toHaveBeenCalled();
    });
  });

  describe("chapter mounting", () => {
    it("mounts the chapter when it is not yet loaded", async () => {
      mountSection(2);

      await jumpToTocItem(createTocItem(2), doc, win as any, parsedBook);

      expect(chapterRendererModule.mountChapter).toHaveBeenCalledWith(
        doc,
        chapters[2],
        2,
      );
    });

    it("adds the chapter index to loadedChapterIndices after mounting", async () => {
      mountSection(2);

      await jumpToTocItem(createTocItem(2), doc, win as any, parsedBook);

      expect(readerStore.getState().loadedChapterIndices.has(2)).toBe(true);
    });

    it("does not call mountChapter when chapter is already loaded", async () => {
      readerStore.getState().addLoadedChapterIndex(1);
      mountSection(1);

      await jumpToTocItem(createTocItem(1), doc, win as any, parsedBook);

      expect(chapterRendererModule.mountChapter).not.toHaveBeenCalled();
    });

    it("clears isMountingChapter after a successful mount", async () => {
      mountSection(0);

      await jumpToTocItem(createTocItem(0), doc, win as any, parsedBook);

      expect(readerStore.getState().isMountingChapter).toBe(false);
    });
  });

  describe("scroll target — no fragment", () => {
    it("scrolls to section offsetTop when no fragmentId", async () => {
      mountSection(1, 400);
      readerStore.getState().addLoadedChapterIndex(1);

      await jumpToTocItem(createTocItem(1), doc, win as any, parsedBook);

      expect(win.scrollTo).toHaveBeenCalledWith(0, 400);
    });

    it("scrolls to 0 when section is at the top", async () => {
      mountSection(0, 0);
      readerStore.getState().addLoadedChapterIndex(0);

      await jumpToTocItem(createTocItem(0), doc, win as any, parsedBook);

      expect(win.scrollTo).toHaveBeenCalledWith(0, 0);
    });
  });

  describe("scroll target — with fragment", () => {
    it("scrolls to the fragment element's position when fragment found", async () => {
      const section = mountSection(2, 300);
      mountFragment(section, "section-1", 450);
      readerStore.getState().addLoadedChapterIndex(2);

      await jumpToTocItem(
        createTocItem(2, "section-1"),
        doc,
        win as any,
        parsedBook,
      );

      expect(win.scrollTo).toHaveBeenCalledWith(0, 450);
    });

    it("falls back to section offsetTop when fragment element not found in DOM", async () => {
      mountSection(2, 300);
      readerStore.getState().addLoadedChapterIndex(2);

      // fragmentId given but no element with that id exists
      await jumpToTocItem(
        createTocItem(2, "missing-id"),
        doc,
        win as any,
        parsedBook,
      );

      expect(win.scrollTo).toHaveBeenCalledWith(0, 300);
    });
  });

  describe("store updates", () => {
    it("sets isJumping to true before scrolling", async () => {
      let isJumpingDuringScroll = false;

      win.scrollTo = vi.fn(() => {
        isJumpingDuringScroll = readerStore.getState().isJumping;
      });

      mountSection(0);

      await jumpToTocItem(createTocItem(0), doc, win as any, parsedBook);

      expect(isJumpingDuringScroll).toBe(true);
    });

    it("releases isJumping on the next animation frame", async () => {
      const rafCalls: FrameRequestCallback[] = [];
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        rafCalls.push(cb);
        return 1;
      });

      mountSection(0);

      await jumpToTocItem(createTocItem(0), doc, win as any, parsedBook);

      // isJumping is true until rAF fires
      expect(readerStore.getState().isJumping).toBe(true);

      rafCalls.forEach((cb) => cb(0));

      expect(readerStore.getState().isJumping).toBe(false);

      vi.unstubAllGlobals();
    });

    it("dispatches a synthetic scroll event after isJumping clears, to trigger window/progress reconciliation", async () => {
      const rafCalls: FrameRequestCallback[] = [];
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        rafCalls.push(cb);
        return 1;
      });

      mountSection(0);

      await jumpToTocItem(createTocItem(0), doc, win as any, parsedBook);

      expect(win.dispatchEvent).not.toHaveBeenCalled();

      rafCalls.forEach((cb) => cb(0));

      expect(win.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "scroll" }),
      );

      vi.unstubAllGlobals();
    });

    it("updates currentChapterIndex in the store", async () => {
      mountSection(3);

      await jumpToTocItem(createTocItem(3), doc, win as any, parsedBook);

      expect(readerStore.getState().currentChapterIndex).toBe(3);
    });
  });

  describe("section not found after mount", () => {
    it("does not scroll when section is missing from DOM after mount", async () => {
      // Chapter is in range but section was never inserted into doc
      await jumpToTocItem(createTocItem(1), doc, win as any, parsedBook);

      expect(win.scrollTo).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("releases isJumping when mountChapter throws", async () => {
      vi.mocked(chapterRendererModule.mountChapter).mockImplementation(() => {
        throw new Error("mount failed");
      });

      // No section in doc — but the throw happens before we reach scrollTo
      await jumpToTocItem(createTocItem(0), doc, win as any, parsedBook);

      expect(readerStore.getState().isJumping).toBe(false);
    });

    it("does not propagate errors to the caller", async () => {
      vi.mocked(chapterRendererModule.mountChapter).mockImplementation(() => {
        throw new Error("mount failed");
      });

      await expect(
        jumpToTocItem(createTocItem(0), doc, win as any, parsedBook),
      ).resolves.not.toThrow();
    });

    it("releases isJumping when loadChapter rejects", async () => {
      parsedBook.loadChapter = vi.fn(() =>
        Promise.reject(new Error("load failed")),
      );

      await jumpToTocItem(createTocItem(0), doc, win as any, parsedBook);

      expect(readerStore.getState().isJumping).toBe(false);
      expect(chapterRendererModule.mountChapter).not.toHaveBeenCalled();
    });
  });
});
