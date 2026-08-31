import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReadingProgress } from "@/services/storage/storage-types";

const CHANNEL_NAME = "librune-reading-progress";

function makeProgress(
  overrides: Partial<ReadingProgress> = {},
): ReadingProgress {
  return {
    chapterIndex: 0,
    totalChapters: 10,
    scrollFraction: 0,
    anchorPath: null,
    atDocumentEnd: false,
    percent: 0,
    updatedAt: 1000,
    ...overrides,
  };
}

describe("reading-progress-channel", () => {
  let otherTabChannel: BroadcastChannel;

  beforeEach(() => {
    vi.resetModules();
    otherTabChannel = new BroadcastChannel(CHANNEL_NAME);
  });

  afterEach(() => {
    otherTabChannel.close();
  });

  it("postPresence/postProgressUpdate reach a listener on another tab's channel instance", async () => {
    const { TAB_ID, postPresence, postProgressUpdate } =
      await import("../reading-progress-channel");

    const received: unknown[] = [];
    otherTabChannel.addEventListener("message", (event: MessageEvent) => {
      received.push(event.data);
    });

    postPresence("book-1");
    const progress = makeProgress();
    postProgressUpdate("book-1", progress);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(received).toEqual([
      { type: "presence", bookId: "book-1", tabId: TAB_ID },
      { type: "progress", bookId: "book-1", progress, tabId: TAB_ID },
    ]);
  });

  it("subscribeToReadingProgressChannel receives messages posted from another tab", async () => {
    const { subscribeToReadingProgressChannel } =
      await import("../reading-progress-channel");

    const handler = vi.fn();
    const unsubscribe = subscribeToReadingProgressChannel(handler);

    otherTabChannel.postMessage({
      type: "presence",
      bookId: "book-2",
      tabId: "other-tab",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handler).toHaveBeenCalledWith({
      type: "presence",
      bookId: "book-2",
      tabId: "other-tab",
    });
    unsubscribe();
  });

  it("unsubscribe stops further delivery", async () => {
    const { subscribeToReadingProgressChannel } =
      await import("../reading-progress-channel");

    const handler = vi.fn();
    const unsubscribe = subscribeToReadingProgressChannel(handler);
    unsubscribe();

    otherTabChannel.postMessage({
      type: "presence",
      bookId: "book-3",
      tabId: "other-tab",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handler).not.toHaveBeenCalled();
  });

  it("falls back to no-ops when BroadcastChannel is unavailable", async () => {
    const original = globalThis.BroadcastChannel;
    // @ts-expect-error simulating an environment without BroadcastChannel
    delete globalThis.BroadcastChannel;

    const {
      postPresence,
      postProgressUpdate,
      subscribeToReadingProgressChannel,
    } = await import("../reading-progress-channel");

    expect(() => postPresence("book-1")).not.toThrow();
    expect(() => postProgressUpdate("book-1", makeProgress())).not.toThrow();
    const unsubscribe = subscribeToReadingProgressChannel(() => {});
    expect(() => unsubscribe()).not.toThrow();

    globalThis.BroadcastChannel = original;
  });
});
