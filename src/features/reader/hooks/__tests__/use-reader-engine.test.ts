import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useReaderEngine } from "../use-reader-engine";
import { readerStore } from "../../store/reader-store";
import * as getChapterSectionsModule from "../../engine/scroll/get-chapter-sections";
import * as detectVisibleChapterModule from "../../engine/scroll/detect-visible-chapter";
import * as maintainChapterWindowModule from "../../engine/windowing/chapter-window";
import * as chapterRendererModule from "../../engine/renderer/chapter-renderer";
import * as saveProgressModule from "../../actions/save-reader-progress";
import type { ParsedBook, ParsedChapter } from "@/services/epub/epub-types";
import type { ReadingProgress } from "@/services/storage/storage-types";
import { jumpToTocItem } from "../../actions/jump-to-toc-item";

const jumpSpy = vi.mocked(jumpToTocItem);

vi.mock("@/shared/logger/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      trace: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock("../../actions/save-reader-progress", () => ({
  computeReaderProgress: vi.fn(() => ({
    chapterIndex: 0,
    totalChapters: 5,
    scrollFraction: 0.5,
    atDocumentEnd: false,
    percent: 10,
    updatedAt: Date.now(),
  })),
  saveReaderProgress: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../actions/jump-to-toc-item", () => ({
  jumpToTocItem: vi.fn(),
}));

describe("useReaderEngine", () => {
  let iframeRef: { current: HTMLIFrameElement | null };
  let mockIframeDoc: Document;

  const createMockChapter = (index: number): ParsedChapter => ({
    id: `ch${index}`,
    href: `text/ch${index}.xhtml`,
    content: `<p>Chapter ${index}</p>`,
    stylesheets: [],
    assetMap: new Map(),
  });

  const mockParsedBook: ParsedBook = {
    metadata: { title: "Test Book", author: "Test Author", language: "en" },
    chapters: Array.from({ length: 5 }, (_, i) => createMockChapter(i)),
    toc: [],
    stylesheets: [],
    loadChapter: (index: number) =>
      Promise.resolve(mockParsedBook.chapters[index]!),
  };

  beforeEach(() => {
    readerStore.getState().reset();
    vi.clearAllMocks();

    // Create mock iframe
    const iframe = document.createElement("iframe");
    iframeRef = { current: iframe };

    // Create mock document
    mockIframeDoc = document.implementation.createHTMLDocument("test");

    // Create minimal mock window
    const mockWin = {
      scrollY: 0,
      innerHeight: 800,
      scrollTo: vi.fn(),
      scrollBy: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      },
    } as any;

    Object.defineProperty(iframe, "contentDocument", {
      value: mockIframeDoc,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(iframe, "contentWindow", {
      value: mockWin,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(iframe, "addEventListener", {
      value: vi.fn((event: string, handler: EventListener) => {
        if (event === "load") {
          // Fire load immediately
          setTimeout(() => handler({} as Event), 0);
        }
      }),
      writable: true,
      configurable: true,
    });

    Object.defineProperty(iframe, "removeEventListener", {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    readerStore.getState().reset();
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("skips effect when iframe is missing", () => {
      const initSpy = vi.spyOn(
        chapterRendererModule,
        "initializeChapterDocument",
      );

      iframeRef.current = null;

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      expect(initSpy).not.toHaveBeenCalled();
    });

    it("skips effect when parsedBook is missing", () => {
      const initSpy = vi.spyOn(
        chapterRendererModule,
        "initializeChapterDocument",
      );

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: null,
        }),
      );

      expect(initSpy).not.toHaveBeenCalled();
    });

    it("initializes chapter document with all chapters", () => {
      const initSpy = vi.spyOn(
        chapterRendererModule,
        "initializeChapterDocument",
      );

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      expect(initSpy).toHaveBeenCalledWith(
        iframeRef.current,
        mockParsedBook.stylesheets,
        undefined,
      );
    });

    it("attaches load event listener to iframe", () => {
      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      expect(iframeRef.current?.addEventListener).toHaveBeenCalledWith(
        "load",
        expect.any(Function),
      );
    });

    it("removes load event listener on cleanup", () => {
      const { unmount } = renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      unmount();

      expect(iframeRef.current?.removeEventListener).toHaveBeenCalledWith(
        "load",
        expect.any(Function),
      );
    });

    it("attaches the load listener before triggering the load (initializeChapterDocument)", () => {
      // A 'load' that fires before the listener is attached would be missed
      // entirely and the reader would hang forever — this ordering is load-bearing.
      const callOrder: string[] = [];

      vi.spyOn(
        chapterRendererModule,
        "initializeChapterDocument",
      ).mockImplementation(() => {
        callOrder.push("initializeChapterDocument");
      });

      const iframe = iframeRef.current!;
      const originalAddEventListener = iframe.addEventListener as ReturnType<
        typeof vi.fn
      >;
      originalAddEventListener.mockImplementation(
        (event: string, handler: EventListener) => {
          if (event === "load") {
            callOrder.push("addEventListener(load)");
            setTimeout(() => handler({} as Event), 0);
          }
        },
      );

      renderHook(() =>
        useReaderEngine({ iframeRef, parsedBook: mockParsedBook }),
      );

      expect(callOrder).toEqual([
        "addEventListener(load)",
        "initializeChapterDocument",
      ]);
    });
  });

  describe("initial chapter loading", () => {
    it("loads initial chapters on iframe load", async () => {
      const mountSpy = vi.spyOn(chapterRendererModule, "mountChapter");

      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        Array.from({ length: 3 }, (_, i) => {
          const section = mockIframeDoc.createElement("section");
          section.setAttribute("data-chapter", String(i));
          return section as HTMLElement;
        }),
      );

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mountSpy).toHaveBeenCalled();
    });

    it("sets initial loaded chapter indices", async () => {
      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        Array.from({ length: 3 }, (_, i) => {
          const section = mockIframeDoc.createElement("section");
          section.setAttribute("data-chapter", String(i));
          return section as HTMLElement;
        }),
      );

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      const loaded = readerStore.getState().loadedChapterIndices;
      expect(loaded.size).toBeGreaterThan(0);
    });
  });

  describe("scroll handling", () => {
    it("attaches scroll listener to iframe window", async () => {
      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        Array.from({ length: 2 }, (_, i) => {
          const section = mockIframeDoc.createElement("section");
          section.setAttribute("data-chapter", String(i));
          return section as HTMLElement;
        }),
      );

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      const mockWin = iframeRef.current?.contentWindow;
      expect(mockWin?.addEventListener).toHaveBeenCalledWith(
        "scroll",
        expect.any(Function),
        { passive: true },
      );
    });

    it("removes scroll listener on cleanup", async () => {
      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        Array.from({ length: 2 }, (_, i) => {
          const section = mockIframeDoc.createElement("section");
          section.setAttribute("data-chapter", String(i));
          return section as HTMLElement;
        }),
      );

      const { unmount } = renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      unmount();

      const mockWin = iframeRef.current?.contentWindow;
      expect(mockWin?.removeEventListener).toHaveBeenCalledWith(
        "scroll",
        expect.any(Function),
      );
    });

    it("detects visible chapter on scroll", async () => {
      const sections = Array.from({ length: 3 }, (_, i) => {
        const section = mockIframeDoc.createElement("section");
        section.setAttribute("data-chapter", String(i));
        (section as HTMLElement).getBoundingClientRect = vi.fn(
          () =>
            ({
              top: i * 100,
            }) as DOMRect,
        );
        return section as HTMLElement;
      });

      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        sections,
      );

      const detectSpy = vi.spyOn(
        detectVisibleChapterModule,
        "detectVisibleChapter",
      );

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(detectSpy).toHaveBeenCalled();
    });

    it("updates current chapter index when visible chapter changes", async () => {
      const sections = Array.from({ length: 3 }, (_, i) => {
        const section = mockIframeDoc.createElement("section");
        section.setAttribute("data-chapter", String(i));
        (section as HTMLElement).getBoundingClientRect = vi.fn(
          () =>
            ({
              top: i * 100,
            }) as DOMRect,
        );
        return section as HTMLElement;
      });

      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        sections,
      );

      vi.spyOn(
        detectVisibleChapterModule,
        "detectVisibleChapter",
      ).mockReturnValue(2);

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(readerStore.getState().currentChapterIndex).toBe(2);
    });

    it("skips scroll handling when jumping", async () => {
      readerStore.getState().setIsJumping(true);

      const sections = Array.from({ length: 2 }, (_, i) => {
        const section = mockIframeDoc.createElement("section");
        section.setAttribute("data-chapter", String(i));
        return section as HTMLElement;
      });

      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        sections,
      );

      const detectSpy = vi.spyOn(
        detectVisibleChapterModule,
        "detectVisibleChapter",
      );

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(detectSpy).not.toHaveBeenCalled();
    });
  });

  describe("window maintenance", () => {
    it("maintains chapter window to keep memory bounded", async () => {
      const maintainSpy = vi.spyOn(
        maintainChapterWindowModule,
        "maintainChapterWindow",
      );

      const sections = Array.from({ length: 3 }, (_, i) => {
        const section = mockIframeDoc.createElement("section");
        section.setAttribute("data-chapter", String(i));
        (section as HTMLElement).getBoundingClientRect = vi.fn(
          () =>
            ({
              top: i * 100,
            }) as DOMRect,
        );
        return section as HTMLElement;
      });

      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        sections,
      );

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(maintainSpy).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("handles missing iframe contentDocument gracefully", () => {
      Object.defineProperty(iframeRef.current, "contentDocument", {
        value: null,
        writable: true,
        configurable: true,
      });

      expect(() => {
        renderHook(() =>
          useReaderEngine({
            iframeRef,
            parsedBook: mockParsedBook,
          }),
        );
      }).not.toThrow();
    });

    it("handles mount failures gracefully", async () => {
      vi.spyOn(chapterRendererModule, "mountChapter").mockImplementation(() => {
        throw new Error("Mount failed");
      });

      const sections = Array.from({ length: 2 }, (_, i) => {
        const section = mockIframeDoc.createElement("section");
        section.setAttribute("data-chapter", String(i));
        return section as HTMLElement;
      });

      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        sections,
      );

      expect(() => {
        renderHook(() =>
          useReaderEngine({
            iframeRef,
            parsedBook: mockParsedBook,
          }),
        );
      }).not.toThrow();
    });
  });

  describe("cleanup", () => {
    it("cancels pending operations on unmount", async () => {
      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        Array.from({ length: 2 }, (_, i) => {
          const section = mockIframeDoc.createElement("section");
          section.setAttribute("data-chapter", String(i));
          return section as HTMLElement;
        }),
      );

      const { unmount } = renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      unmount();

      expect(iframeRef.current?.removeEventListener).toHaveBeenCalled();
    });

    it("only runs effect when dependencies change", () => {
      const initSpy = vi.spyOn(
        chapterRendererModule,
        "initializeChapterDocument",
      );

      const { rerender } = renderHook(
        ({ book }) =>
          useReaderEngine({
            iframeRef,
            parsedBook: book,
          }),
        { initialProps: { book: mockParsedBook } },
      );

      initSpy.mockClear();

      rerender({ book: mockParsedBook });

      expect(initSpy).not.toHaveBeenCalled();
    });
  });

  describe("progress persistence", () => {
    const sectionsForChapters = (count: number) => {
      const sections = Array.from({ length: count }, (_, i) => {
        const section = mockIframeDoc.createElement("section");
        section.setAttribute("data-chapter", String(i));
        (section as HTMLElement).getBoundingClientRect = vi.fn(
          () => ({ top: i * 100 }) as DOMRect,
        );
        return section as HTMLElement;
      });
      // restoreInitialPosition looks these up via iframeDoc.querySelector,
      // not via the getChapterSections spy — so they need to actually be
      // in the mock document, not just returned by the mock.
      sections.forEach((section) => mockIframeDoc.body.appendChild(section));
      return sections;
    };

    it("does not schedule a save when no bookId is provided", async () => {
      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        sectionsForChapters(3),
      );

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(saveProgressModule.saveReaderProgress).not.toHaveBeenCalled();
    });

    it("debounces saves so rapid scrolling only persists once, not once per scroll", async () => {
      vi.useFakeTimers();

      try {
        vi.spyOn(
          getChapterSectionsModule,
          "getChapterSections",
        ).mockReturnValue(sectionsForChapters(3));

        renderHook(() =>
          useReaderEngine({
            iframeRef,
            parsedBook: mockParsedBook,
            bookId: "book-1",
          }),
        );

        // Flush the mocked iframe "load" event's setTimeout(0) and the
        // synchronous startEngine chain that follows it.
        await vi.advanceTimersByTimeAsync(0);

        const mockWin = iframeRef.current?.contentWindow as any;
        const onScroll = mockWin.addEventListener.mock.calls.find(
          ([event]: [string]) => event === "scroll",
        )?.[1];
        expect(onScroll).toBeDefined();

        // Three scroll events in quick succession, each well inside the
        // debounce window — every one should reset the pending timer
        // rather than queuing an additional save.
        onScroll();
        await vi.advanceTimersByTimeAsync(400);
        onScroll();
        await vi.advanceTimersByTimeAsync(400);
        onScroll();
        await vi.advanceTimersByTimeAsync(400);

        // Only 400ms has passed since the *last* scroll — still under the
        // debounce window — so nothing should have saved yet.
        expect(saveProgressModule.saveReaderProgress).not.toHaveBeenCalled();

        // Let the debounce actually elapse from that last scroll.
        await vi.advanceTimersByTimeAsync(1200);

        expect(saveProgressModule.saveReaderProgress).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("flushes a pending save immediately on unmount instead of losing it", async () => {
      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        sectionsForChapters(3),
      );

      const { unmount } = renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          bookId: "book-1",
        }),
      );

      // Initial handleScroll (fired once automatically after sections are
      // ready) already schedules a debounced save — well before its
      // PROGRESS_SAVE_DEBOUNCE_MS timer would fire, unmount happens.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(saveProgressModule.saveReaderProgress).not.toHaveBeenCalled();

      unmount();

      expect(saveProgressModule.saveReaderProgress).toHaveBeenCalledWith(
        "book-1",
        expect.objectContaining({ chapterIndex: expect.any(Number) }),
      );
    });

    it("restores the saved chapter/scroll position instead of starting at chapter 0", async () => {
      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        sectionsForChapters(3),
      );

      const initialProgress: ReadingProgress = {
        chapterIndex: 1,
        totalChapters: 5,
        scrollFraction: 0.5,
        atDocumentEnd: false,
        percent: 30,
        updatedAt: Date.now(),
      };

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          bookId: "book-1",
          initialProgress,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      const mockWin = iframeRef.current?.contentWindow as any;
      expect(mockWin.scrollTo).toHaveBeenCalled();

      // isJumping must be released again after the restore settles, so
      // the reader isn't permanently stuck ignoring real scroll events.
      expect(readerStore.getState().isJumping).toBe(false);
    });

    it("restores by anchor element when available, instead of the raw scroll fraction", async () => {
      const sections = sectionsForChapters(3);
      const targetSection = sections[1]!;
      const p = mockIframeDoc.createElement("p");
      // Deliberately different from what fraction-based math would give
      // (section.offsetTop=0 here + 0.5*sectionHeight), so the assertion
      // can only pass if the anchor path was actually used.
      p.getBoundingClientRect = vi.fn(() => ({ top: 777 }) as DOMRect);
      targetSection.appendChild(p);

      const initialProgress: ReadingProgress = {
        chapterIndex: 1,
        totalChapters: 5,
        scrollFraction: 0.5,
        anchorPath: [0],
        atDocumentEnd: false,
        percent: 30,
        updatedAt: Date.now(),
      };

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          bookId: "book-1",
          initialProgress,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      const mockWin = iframeRef.current?.contentWindow as any;
      // mockWin.scrollY is 0, so targetY = 0 + 777.
      expect(mockWin.scrollTo).toHaveBeenCalledWith(0, 777);
    });

    it("falls back to scroll fraction when the anchor path doesn't resolve", async () => {
      sectionsForChapters(3); // no <p> children — path [0] won't resolve

      const initialProgress: ReadingProgress = {
        chapterIndex: 1,
        totalChapters: 5,
        scrollFraction: 0.5,
        anchorPath: [0],
        atDocumentEnd: false,
        percent: 30,
        updatedAt: Date.now(),
      };

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          bookId: "book-1",
          initialProgress,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      const mockWin = iframeRef.current?.contentWindow as any;
      expect(mockWin.scrollTo).toHaveBeenCalled();
      // Whatever it scrolled to, it must NOT be the anchor-only 777 sentinel
      // from the previous test — confirming this path used fraction math.
      expect(mockWin.scrollTo).not.toHaveBeenCalledWith(0, 777);
    });

    it("retries restoring position if the target section isn't mounted yet, until it appears", async () => {
      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        sectionsForChapters(3), // chapters 0,1,2 mounted immediately
      );

      const initialProgress: ReadingProgress = {
        chapterIndex: 3, // not among the initially-mounted sections
        totalChapters: 5,
        scrollFraction: 0.5,
        atDocumentEnd: false,
        percent: 50,
        updatedAt: Date.now(),
      };

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          bookId: "book-1",
          initialProgress,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      const mockWin = iframeRef.current?.contentWindow as any;
      expect(mockWin.scrollTo).not.toHaveBeenCalled();

      // Simulate the target chapter mounting a bit late.
      const section3 = mockIframeDoc.createElement("section");
      section3.setAttribute("data-chapter", "3");
      mockIframeDoc.body.appendChild(section3);

      // Let the rAF-based retry loop pick it up.
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(mockWin.scrollTo).toHaveBeenCalled();
    });

    it("gives up after max retries if the target section never mounts, and falls back to handleScroll", async () => {
      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        sectionsForChapters(3),
      );
      const detectSpy = vi.spyOn(
        detectVisibleChapterModule,
        "detectVisibleChapter",
      );

      const initialProgress: ReadingProgress = {
        chapterIndex: 3, // never mounted in this test
        totalChapters: 5,
        scrollFraction: 0.5,
        atDocumentEnd: false,
        percent: 50,
        updatedAt: Date.now(),
      };

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          bookId: "book-1",
          initialProgress,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      const mockWin = iframeRef.current?.contentWindow as any;
      expect(mockWin.scrollTo).not.toHaveBeenCalled();
      expect(detectSpy).toHaveBeenCalled();
    });

    it("does not restore scroll position when no initialProgress is given", async () => {
      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        sectionsForChapters(3),
      );

      const isJumpingCalls: boolean[] = [];
      const unsubscribe = readerStore.subscribe((state) => {
        isJumpingCalls.push(state.isJumping);
      });

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          bookId: "book-1",
          initialProgress: null,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));
      unsubscribe();

      // The restore path is the only thing that ever sets isJumping to
      // true — a scrollTo(0, 0) can legitimately still fire from
      // unrelated windowing logic (e.g. preserving position when a
      // previous chapter loads), so isJumping is the correct signal
      // here, not "was scrollTo called at all".
      expect(isJumpingCalls).not.toContain(true);
      expect(readerStore.getState().isJumping).toBe(false);
    });
  });

  describe("resize/orientation handling", () => {
    const sectionsForChapters = (count: number) => {
      const sections = Array.from({ length: count }, (_, i) => {
        const section = mockIframeDoc.createElement("section");
        section.setAttribute("data-chapter", String(i));
        (section as HTMLElement).getBoundingClientRect = vi.fn(
          () => ({ top: i * 100 }) as DOMRect,
        );
        return section as HTMLElement;
      });
      sections.forEach((section) => mockIframeDoc.body.appendChild(section));
      return sections;
    };

    it("attaches resize and orientationchange listeners", async () => {
      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        sectionsForChapters(3),
      );
      const windowAddSpy = vi.spyOn(window, "addEventListener");

      renderHook(() =>
        useReaderEngine({ iframeRef, parsedBook: mockParsedBook }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      const mockWin = iframeRef.current?.contentWindow as any;
      expect(mockWin.addEventListener).toHaveBeenCalledWith(
        "resize",
        expect.any(Function),
      );
      expect(windowAddSpy).toHaveBeenCalledWith(
        "orientationchange",
        expect.any(Function),
      );
    });

    it("re-anchors scroll position (debounced) after a resize", async () => {
      vi.useFakeTimers();

      try {
        vi.spyOn(
          getChapterSectionsModule,
          "getChapterSections",
        ).mockReturnValue(sectionsForChapters(3));

        renderHook(() =>
          useReaderEngine({ iframeRef, parsedBook: mockParsedBook }),
        );

        await vi.advanceTimersByTimeAsync(0);

        const mockWin = iframeRef.current?.contentWindow as any;
        const onResize = mockWin.addEventListener.mock.calls.find(
          ([event]: [string]) => event === "resize",
        )?.[1];
        expect(onResize).toBeDefined();

        mockWin.scrollTo.mockClear();
        onResize();

        // Debounced — nothing should happen immediately.
        expect(mockWin.scrollTo).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(200);

        expect(mockWin.scrollTo).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("removes resize/orientationchange listeners on unmount", async () => {
      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        sectionsForChapters(3),
      );

      const { unmount } = renderHook(() =>
        useReaderEngine({ iframeRef, parsedBook: mockParsedBook }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      const mockWin = iframeRef.current?.contentWindow as any;
      unmount();

      expect(mockWin.removeEventListener).toHaveBeenCalledWith(
        "resize",
        expect.any(Function),
      );
    });
  });

  describe("link click handling", () => {
    // Helper: fire a synthetic click on the iframeDoc with a given href.
    // Simulates clicking an <a> element (or a child of one).
    const fireClick = (href: string, useChildElement = false) => {
      const anchor = mockIframeDoc.createElement("a");
      anchor.setAttribute("href", href);

      const target = useChildElement
        ? (() => {
            const em = mockIframeDoc.createElement("em");
            anchor.appendChild(em);
            return em;
          })()
        : anchor;

      mockIframeDoc.body.appendChild(anchor);

      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "target", {
        value: target,
        configurable: true,
      });
      // Use dispatchEvent on the anchor so .closest("a") works up the real DOM
      anchor.dispatchEvent(event);

      return event;
    };

    const setupWithSections = async () => {
      const sections = Array.from({ length: 3 }, (_, i) => {
        const section = mockIframeDoc.createElement("section");
        section.setAttribute("data-chapter", String(i));
        mockIframeDoc.body.appendChild(section);
        return section as HTMLElement;
      });

      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        sections,
      );
    };

    it("calls onExternalLink for https URLs and does not navigate", async () => {
      await setupWithSections();
      const onExternalLink = vi.fn();

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          onExternalLink,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      fireClick("https://example.com/page");

      expect(onExternalLink).toHaveBeenCalledWith("https://example.com/page");
    });

    it("calls onExternalLink for mailto: links", async () => {
      await setupWithSections();
      const onExternalLink = vi.fn();

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          onExternalLink,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      fireClick("mailto:author@example.com");

      expect(onExternalLink).toHaveBeenCalledWith("mailto:author@example.com");
    });

    it("does not call onExternalLink for internal links", async () => {
      await setupWithSections();
      const onExternalLink = vi.fn();

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          onExternalLink,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      fireClick("ch1.xhtml");

      expect(onExternalLink).not.toHaveBeenCalled();
    });

    it("jumps to correct chapter for an internal link matching a spine item", async () => {
      await setupWithSections();

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      fireClick("ch1.xhtml");

      expect(jumpSpy).toHaveBeenCalledWith(
        expect.objectContaining({ chapterIndex: 1 }),
        mockIframeDoc,
        expect.any(Object),
        mockParsedBook,
      );
    });

    it("passes fragmentId when internal link contains a hash", async () => {
      await setupWithSections();

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      fireClick("ch2.xhtml#section-1");

      expect(jumpSpy).toHaveBeenCalledWith(
        expect.objectContaining({ chapterIndex: 2, fragmentId: "section-1" }),
        mockIframeDoc,
        expect.any(Object),
        mockParsedBook,
      );
    });

    it("does not navigate for internal links not in the spine", async () => {
      await setupWithSections();

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      fireClick("not-in-spine.xhtml");

      expect(jumpSpy).not.toHaveBeenCalled();
    });

    it("finds anchor when click target is a child element of <a>", async () => {
      await setupWithSections();
      const onExternalLink = vi.fn();

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          onExternalLink,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Click fires on <em> inside <a href="https://...">
      fireClick("https://example.com", true);

      expect(onExternalLink).toHaveBeenCalledWith("https://example.com");
    });

    it("ignores clicks on elements with no anchor ancestor", async () => {
      await setupWithSections();
      const onExternalLink = vi.fn();

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          onExternalLink,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      const p = mockIframeDoc.createElement("p");
      p.textContent = "plain text";
      mockIframeDoc.body.appendChild(p);
      p.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );

      expect(onExternalLink).not.toHaveBeenCalled();
      expect(jumpSpy).not.toHaveBeenCalled();
    });

    it("ignores anchor elements with no href", async () => {
      await setupWithSections();
      const onExternalLink = vi.fn();

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          onExternalLink,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      const anchor = mockIframeDoc.createElement("a");
      // no href attribute
      mockIframeDoc.body.appendChild(anchor);
      anchor.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );

      expect(onExternalLink).not.toHaveBeenCalled();
    });

    it("removes click listener on cleanup", async () => {
      await setupWithSections();
      const removeListenerSpy = vi.spyOn(mockIframeDoc, "removeEventListener");

      const { unmount } = renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      unmount();

      expect(removeListenerSpy).toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );
    });
  });

  describe("keyboard and swipe navigation", () => {
    const setupWithSections = async () => {
      const sections = Array.from({ length: 3 }, (_, i) => {
        const section = mockIframeDoc.createElement("section");
        section.setAttribute("data-chapter", String(i));
        mockIframeDoc.body.appendChild(section);
        return section as HTMLElement;
      });

      vi.spyOn(getChapterSectionsModule, "getChapterSections").mockReturnValue(
        sections,
      );
    };

    it("scrolls forward on PageDown/ArrowDown/Space", async () => {
      await setupWithSections();

      renderHook(() =>
        useReaderEngine({ iframeRef, parsedBook: mockParsedBook }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      const mockWin = iframeRef.current?.contentWindow as any;

      for (const key of ["PageDown", "ArrowDown", " "]) {
        mockWin.scrollBy.mockClear();
        mockIframeDoc.dispatchEvent(
          new KeyboardEvent("keydown", { key, cancelable: true }),
        );
        expect(mockWin.scrollBy).toHaveBeenCalledWith(
          expect.objectContaining({ top: expect.any(Number) }),
        );
        expect(mockWin.scrollBy.mock.calls[0][0].top).toBeGreaterThan(0);
      }
    });

    it("scrolls backward on PageUp/ArrowUp", async () => {
      await setupWithSections();

      renderHook(() =>
        useReaderEngine({ iframeRef, parsedBook: mockParsedBook }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      const mockWin = iframeRef.current?.contentWindow as any;

      for (const key of ["PageUp", "ArrowUp"]) {
        mockWin.scrollBy.mockClear();
        mockIframeDoc.dispatchEvent(
          new KeyboardEvent("keydown", { key, cancelable: true }),
        );
        expect(mockWin.scrollBy.mock.calls[0][0].top).toBeLessThan(0);
      }
    });

    it("calls onSwipeChapter(1) on a leftward swipe", async () => {
      await setupWithSections();
      const onSwipeChapter = vi.fn();

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          onSwipeChapter,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      mockIframeDoc.dispatchEvent(
        new TouchEvent("touchstart", {
          touches: [{ clientX: 300, clientY: 100 } as Touch],
        }),
      );
      mockIframeDoc.dispatchEvent(
        new TouchEvent("touchend", {
          changedTouches: [{ clientX: 200, clientY: 100 } as Touch],
        }),
      );

      expect(onSwipeChapter).toHaveBeenCalledWith(1);
    });

    it("calls onSwipeChapter(-1) on a rightward swipe", async () => {
      await setupWithSections();
      const onSwipeChapter = vi.fn();

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          onSwipeChapter,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      mockIframeDoc.dispatchEvent(
        new TouchEvent("touchstart", {
          touches: [{ clientX: 100, clientY: 100 } as Touch],
        }),
      );
      mockIframeDoc.dispatchEvent(
        new TouchEvent("touchend", {
          changedTouches: [{ clientX: 250, clientY: 100 } as Touch],
        }),
      );

      expect(onSwipeChapter).toHaveBeenCalledWith(-1);
    });

    it("ignores a short swipe below the distance threshold", async () => {
      await setupWithSections();
      const onSwipeChapter = vi.fn();

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          onSwipeChapter,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      mockIframeDoc.dispatchEvent(
        new TouchEvent("touchstart", {
          touches: [{ clientX: 100, clientY: 100 } as Touch],
        }),
      );
      mockIframeDoc.dispatchEvent(
        new TouchEvent("touchend", {
          changedTouches: [{ clientX: 120, clientY: 100 } as Touch],
        }),
      );

      expect(onSwipeChapter).not.toHaveBeenCalled();
    });

    it("ignores a diagonal drag with too much vertical drift", async () => {
      await setupWithSections();
      const onSwipeChapter = vi.fn();

      renderHook(() =>
        useReaderEngine({
          iframeRef,
          parsedBook: mockParsedBook,
          onSwipeChapter,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      mockIframeDoc.dispatchEvent(
        new TouchEvent("touchstart", {
          touches: [{ clientX: 100, clientY: 100 } as Touch],
        }),
      );
      mockIframeDoc.dispatchEvent(
        new TouchEvent("touchend", {
          changedTouches: [{ clientX: 250, clientY: 300 } as Touch],
        }),
      );

      expect(onSwipeChapter).not.toHaveBeenCalled();
    });
  });
});
