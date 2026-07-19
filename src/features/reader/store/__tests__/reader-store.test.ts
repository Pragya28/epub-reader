import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readerStore } from "../reader-store";

describe("readerStore", () => {
  beforeEach(() => {
    readerStore.getState().reset();
  });

  afterEach(() => {
    readerStore.getState().reset();
  });

  describe("initial state", () => {
    it("has null readerDocument", () => {
      expect(readerStore.getState().readerDocument).toBeNull();
    });

    it("has null parsedBook", () => {
      expect(readerStore.getState().parsedBook).toBeNull();
    });

    it("starts at chapter 0", () => {
      expect(readerStore.getState().currentChapterIndex).toBe(0);
    });

    it("is not loading initially", () => {
      expect(readerStore.getState().isLoading).toBe(false);
    });

    it("has no error initially", () => {
      expect(readerStore.getState().error).toBeNull();
    });

    it("has empty loadedChapterIndices Set", () => {
      expect(readerStore.getState().loadedChapterIndices).toEqual(new Set());
    });

    it("is not mounting chapter initially", () => {
      expect(readerStore.getState().isMountingChapter).toBe(false);
    });

    it("is not jumping initially", () => {
      expect(readerStore.getState().isJumping).toBe(false);
    });
  });

  describe("setReaderDocument", () => {
    it("sets readerDocument", () => {
      const mockDocument = {
        book: { id: "1", title: "Test Book" },
        file: new ArrayBuffer(0),
      } as any;

      readerStore.getState().setReaderDocument(mockDocument);

      expect(readerStore.getState().readerDocument).toBe(mockDocument);
      expect(readerStore.getState().readerDocument?.book?.id).toBe("1");
    });

    it("can update readerDocument multiple times", () => {
      const doc1 = { book: { id: "1" } } as any;
      const doc2 = { book: { id: "2" } } as any;

      readerStore.getState().setReaderDocument(doc1);
      expect(readerStore.getState().readerDocument?.book?.id).toBe("1");

      readerStore.getState().setReaderDocument(doc2);
      expect(readerStore.getState().readerDocument?.book?.id).toBe("2");
    });

    it("triggers store update (devtools action name)", () => {
      const doc = { book: { id: "1" } } as any;
      let updateCount = 0;

      const unsubscribe = readerStore.subscribe(() => {
        updateCount++;
      });

      readerStore.getState().setReaderDocument(doc);
      expect(updateCount).toBeGreaterThan(0);

      unsubscribe();
    });
  });

  describe("setParsedBook", () => {
    it("sets parsedBook", () => {
      const mockBook = {
        metadata: { title: "Test" },
        spine: [],
        toc: [],
      } as any;

      readerStore.getState().setParsedBook(mockBook);

      expect(readerStore.getState().parsedBook).toBe(mockBook);
      expect(readerStore.getState().parsedBook?.metadata?.title).toBe("Test");
    });

    it("can be set independently from readerDocument", () => {
      const doc = { book: { id: "1" } } as any;
      const book = { metadata: { title: "Test" } } as any;

      readerStore.getState().setReaderDocument(doc);
      readerStore.getState().setParsedBook(book);

      expect(readerStore.getState().readerDocument).toBe(doc);
      expect(readerStore.getState().parsedBook).toBe(book);
    });
  });

  describe("setCurrentChapterIndex", () => {
    it("updates current chapter index", () => {
      readerStore.getState().setCurrentChapterIndex(3);
      expect(readerStore.getState().currentChapterIndex).toBe(3);
    });

    it("can jump to different indices", () => {
      readerStore.getState().setCurrentChapterIndex(0);
      expect(readerStore.getState().currentChapterIndex).toBe(0);

      readerStore.getState().setCurrentChapterIndex(10);
      expect(readerStore.getState().currentChapterIndex).toBe(10);

      readerStore.getState().setCurrentChapterIndex(5);
      expect(readerStore.getState().currentChapterIndex).toBe(5);
    });

    it("handles zero index", () => {
      readerStore.getState().setCurrentChapterIndex(5);
      readerStore.getState().setCurrentChapterIndex(0);
      expect(readerStore.getState().currentChapterIndex).toBe(0);
    });

    it("handles large indices", () => {
      readerStore.getState().setCurrentChapterIndex(9999);
      expect(readerStore.getState().currentChapterIndex).toBe(9999);
    });
  });

  describe("setLoading", () => {
    it("sets loading state to true", () => {
      readerStore.getState().setLoading(true);
      expect(readerStore.getState().isLoading).toBe(true);
    });

    it("sets loading state to false", () => {
      readerStore.getState().setLoading(true);
      readerStore.getState().setLoading(false);
      expect(readerStore.getState().isLoading).toBe(false);
    });

    it("can toggle loading state", () => {
      expect(readerStore.getState().isLoading).toBe(false);

      readerStore.getState().setLoading(true);
      expect(readerStore.getState().isLoading).toBe(true);

      readerStore.getState().setLoading(false);
      expect(readerStore.getState().isLoading).toBe(false);
    });
  });

  describe("setError", () => {
    it("sets error message", () => {
      readerStore.getState().setError("Failed to load book");
      expect(readerStore.getState().error).toBe("Failed to load book");
    });

    it("clears error by setting to null", () => {
      readerStore.getState().setError("Some error");
      readerStore.getState().setError(null);
      expect(readerStore.getState().error).toBeNull();
    });

    it("can update error message", () => {
      readerStore.getState().setError("First error");
      expect(readerStore.getState().error).toBe("First error");

      readerStore.getState().setError("Second error");
      expect(readerStore.getState().error).toBe("Second error");
    });

    it("handles empty string error", () => {
      readerStore.getState().setError("");
      expect(readerStore.getState().error).toBe("");
    });
  });

  describe("addLoadedChapterIndex", () => {
    it("adds chapter index to loadedChapterIndices Set", () => {
      readerStore.getState().addLoadedChapterIndex(0);
      expect(readerStore.getState().loadedChapterIndices.has(0)).toBe(true);
    });

    it("adds multiple distinct indices", () => {
      readerStore.getState().addLoadedChapterIndex(0);
      readerStore.getState().addLoadedChapterIndex(1);
      readerStore.getState().addLoadedChapterIndex(3);

      const loaded = readerStore.getState().loadedChapterIndices;
      expect(loaded.has(0)).toBe(true);
      expect(loaded.has(1)).toBe(true);
      expect(loaded.has(3)).toBe(true);
      expect(loaded.size).toBe(3);
    });

    it("does not create duplicates (Set behavior)", () => {
      readerStore.getState().addLoadedChapterIndex(0);
      readerStore.getState().addLoadedChapterIndex(0);
      readerStore.getState().addLoadedChapterIndex(0);

      expect(readerStore.getState().loadedChapterIndices.size).toBe(1);
      expect(readerStore.getState().loadedChapterIndices.has(0)).toBe(true);
    });

    it("creates a new Set reference (immutable)", () => {
      const before = readerStore.getState().loadedChapterIndices;
      readerStore.getState().addLoadedChapterIndex(0);
      const after = readerStore.getState().loadedChapterIndices;

      expect(before).not.toBe(after);
    });
  });

  describe("removeLoadedChapterIndex", () => {
    it("removes chapter index from loadedChapterIndices Set", () => {
      readerStore.getState().addLoadedChapterIndex(0);
      readerStore.getState().addLoadedChapterIndex(1);

      readerStore.getState().removeLoadedChapterIndex(0);

      expect(readerStore.getState().loadedChapterIndices.has(0)).toBe(false);
      expect(readerStore.getState().loadedChapterIndices.has(1)).toBe(true);
    });

    it("handles removing non-existent index gracefully", () => {
      readerStore.getState().addLoadedChapterIndex(0);

      expect(() => {
        readerStore.getState().removeLoadedChapterIndex(999);
      }).not.toThrow();

      expect(readerStore.getState().loadedChapterIndices.has(0)).toBe(true);
    });

    it("can remove all indices one by one", () => {
      readerStore.getState().addLoadedChapterIndex(0);
      readerStore.getState().addLoadedChapterIndex(1);
      readerStore.getState().addLoadedChapterIndex(2);

      readerStore.getState().removeLoadedChapterIndex(0);
      readerStore.getState().removeLoadedChapterIndex(1);
      readerStore.getState().removeLoadedChapterIndex(2);

      expect(readerStore.getState().loadedChapterIndices.size).toBe(0);
    });

    it("creates a new Set reference (immutable)", () => {
      readerStore.getState().addLoadedChapterIndex(0);
      const before = readerStore.getState().loadedChapterIndices;

      readerStore.getState().removeLoadedChapterIndex(0);
      const after = readerStore.getState().loadedChapterIndices;

      expect(before).not.toBe(after);
    });
  });

  describe("setIsMountingChapter", () => {
    it("sets mounting chapter flag to true", () => {
      readerStore.getState().setIsMountingChapter(true);
      expect(readerStore.getState().isMountingChapter).toBe(true);
    });

    it("sets mounting chapter flag to false", () => {
      readerStore.getState().setIsMountingChapter(true);
      readerStore.getState().setIsMountingChapter(false);
      expect(readerStore.getState().isMountingChapter).toBe(false);
    });

    it("can toggle mounting state", () => {
      readerStore.getState().setIsMountingChapter(true);
      expect(readerStore.getState().isMountingChapter).toBe(true);

      readerStore.getState().setIsMountingChapter(false);
      expect(readerStore.getState().isMountingChapter).toBe(false);
    });
  });

  describe("setIsJumping", () => {
    it("sets jumping flag to true", () => {
      readerStore.getState().setIsJumping(true);
      expect(readerStore.getState().isJumping).toBe(true);
    });

    it("sets jumping flag to false", () => {
      readerStore.getState().setIsJumping(true);
      readerStore.getState().setIsJumping(false);
      expect(readerStore.getState().isJumping).toBe(false);
    });

    it("can toggle jumping state", () => {
      readerStore.getState().setIsJumping(true);
      expect(readerStore.getState().isJumping).toBe(true);

      readerStore.getState().setIsJumping(false);
      expect(readerStore.getState().isJumping).toBe(false);
    });
  });

  describe("reset", () => {
    it("resets all state to initial values", () => {
      readerStore.getState().setReaderDocument({ book: { id: "1" } } as any);
      readerStore
        .getState()
        .setParsedBook({ metadata: { title: "Test" } } as any);
      readerStore.getState().setCurrentChapterIndex(5);
      readerStore.getState().setLoading(true);
      readerStore.getState().setError("Some error");
      readerStore.getState().addLoadedChapterIndex(0);
      readerStore.getState().addLoadedChapterIndex(1);
      readerStore.getState().setIsMountingChapter(true);
      readerStore.getState().setIsJumping(true);

      readerStore.getState().reset();

      const state = readerStore.getState();
      expect(state.readerDocument).toBeNull();
      expect(state.parsedBook).toBeNull();
      expect(state.currentChapterIndex).toBe(0);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.loadedChapterIndices.size).toBe(0);
      expect(state.isMountingChapter).toBe(false);
      expect(state.isJumping).toBe(false);
    });

    it("creates a fresh Set instance for loadedChapterIndices", () => {
      readerStore.getState().addLoadedChapterIndex(0);
      const before = readerStore.getState().loadedChapterIndices;

      readerStore.getState().reset();
      const after = readerStore.getState().loadedChapterIndices;

      expect(before).not.toBe(after);
      expect(after.size).toBe(0);
    });

    it("allows adding to Set after reset", () => {
      readerStore.getState().addLoadedChapterIndex(0);
      readerStore.getState().reset();

      readerStore.getState().addLoadedChapterIndex(1);

      expect(readerStore.getState().loadedChapterIndices.has(1)).toBe(true);
      expect(readerStore.getState().loadedChapterIndices.size).toBe(1);
    });
  });

  describe("state immutability", () => {
    it("Set mutations via actions create new Set references", () => {
      const initialSet = readerStore.getState().loadedChapterIndices;

      readerStore.getState().addLoadedChapterIndex(0);
      const afterAdd = readerStore.getState().loadedChapterIndices;

      expect(initialSet).not.toBe(afterAdd);
    });

    it("multiple subscribers receive updates", () => {
      let count1 = 0;
      let count2 = 0;

      const unsub1 = readerStore.subscribe(() => {
        count1++;
      });
      const unsub2 = readerStore.subscribe(() => {
        count2++;
      });

      readerStore.getState().setLoading(true);

      expect(count1).toBeGreaterThan(0);
      expect(count2).toBeGreaterThan(0);

      unsub1();
      unsub2();
    });
  });

  describe("complex workflows", () => {
    it("loading a book: setLoading -> setError -> setReaderDocument + setParsedBook", () => {
      readerStore.getState().setLoading(true);
      expect(readerStore.getState().isLoading).toBe(true);

      readerStore.getState().setError(null);
      expect(readerStore.getState().error).toBeNull();

      const doc = { book: { id: "test-book" } } as any;
      const book = {
        metadata: { title: "Test Book" },
        spine: [],
        toc: [],
      } as any;

      readerStore.getState().setReaderDocument(doc);
      readerStore.getState().setParsedBook(book);

      readerStore.getState().setLoading(false);

      const state = readerStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.readerDocument?.book?.id).toBe("test-book");
      expect(state.parsedBook?.metadata?.title).toBe("Test Book");
    });

    it("loading chapters: tracking loaded indices and mounting state", () => {
      const chapters = [0, 1, 2, 3, 4];

      chapters.forEach((ch) => {
        readerStore.getState().setIsMountingChapter(true);
        readerStore.getState().addLoadedChapterIndex(ch);
        readerStore.getState().setIsMountingChapter(false);
      });

      const state = readerStore.getState();
      expect(state.loadedChapterIndices.size).toBe(5);
      expect(state.isMountingChapter).toBe(false);
    });

    it("unloading chapters: removing from loaded indices", () => {
      readerStore.getState().addLoadedChapterIndex(0);
      readerStore.getState().addLoadedChapterIndex(1);
      readerStore.getState().addLoadedChapterIndex(2);

      const toUnload = [0, 2];
      toUnload.forEach((ch) => {
        readerStore.getState().removeLoadedChapterIndex(ch);
      });

      const state = readerStore.getState();
      expect(state.loadedChapterIndices.has(1)).toBe(true);
      expect(state.loadedChapterIndices.has(0)).toBe(false);
      expect(state.loadedChapterIndices.has(2)).toBe(false);
    });

    it("jumping to chapter: setIsJumping + setCurrentChapterIndex", () => {
      readerStore.getState().setIsJumping(true);
      readerStore.getState().setCurrentChapterIndex(10);

      expect(readerStore.getState().isJumping).toBe(true);
      expect(readerStore.getState().currentChapterIndex).toBe(10);

      readerStore.getState().setIsJumping(false);
    });

    it("error handling: setLoading -> setError -> reset", () => {
      readerStore.getState().setLoading(true);
      readerStore.getState().setError("Failed to parse EPUB");

      expect(readerStore.getState().isLoading).toBe(true);
      expect(readerStore.getState().error).toBe("Failed to parse EPUB");

      readerStore.getState().reset();

      const state = readerStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
