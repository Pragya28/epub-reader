import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useReaderEngine } from "../use-reader-engine";
import { readerStore } from "../../store/reader-store";
import * as getChapterSectionsModule from "../../engine/scroll/get-chapter-sections";
import * as detectVisibleChapterModule from "../../engine/scroll/detect-visible-chapter";
import * as maintainChapterWindowModule from "../../engine/windowing/chapter-window";
import * as chapterRendererModule from "../../engine/renderer/chapter-renderer";
import type { ParsedBook, ParsedChapter } from "@/services/epub/epub-types";

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
});
