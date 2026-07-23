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
        mockParsedBook.chapters,
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
});
