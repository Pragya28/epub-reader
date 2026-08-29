import { afterEach, describe, expect, it, vi } from "vitest";
import {
  estimateStorage,
  hasRoomFor,
  isStoragePersisted,
  requestPersistentStorage,
} from "../storage-quota";

function stubStorage(value: Partial<StorageManager> | undefined) {
  Object.defineProperty(navigator, "storage", {
    value,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  stubStorage(undefined);
});

describe("estimateStorage", () => {
  it("returns null when the API is unavailable", async () => {
    stubStorage({});
    expect(await estimateStorage()).toBeNull();
  });

  it("returns null when quota is 0 (private mode)", async () => {
    stubStorage({ estimate: async () => ({ usage: 0, quota: 0 }) });
    expect(await estimateStorage()).toBeNull();
  });

  it("computes percent used", async () => {
    stubStorage({
      estimate: async () => ({ usage: 25_000, quota: 100_000 }),
    });
    expect(await estimateStorage()).toEqual({
      usageBytes: 25_000,
      quotaBytes: 100_000,
      percentUsed: 25,
    });
  });

  it("swallows a throwing estimate()", async () => {
    stubStorage({
      estimate: async () => {
        throw new Error("nope");
      },
    });
    expect(await estimateStorage()).toBeNull();
  });
});

describe("requestPersistentStorage / isStoragePersisted", () => {
  it("returns false when unsupported", async () => {
    stubStorage({});
    expect(await requestPersistentStorage()).toBe(false);
    expect(await isStoragePersisted()).toBe(false);
  });

  it("passes through the browser's decision", async () => {
    stubStorage({
      persist: async () => true,
      persisted: async () => true,
    });
    expect(await requestPersistentStorage()).toBe(true);
    expect(await isStoragePersisted()).toBe(true);
  });

  it("swallows a throwing persist()", async () => {
    stubStorage({
      persist: async () => {
        throw new Error("nope");
      },
    });
    expect(await requestPersistentStorage()).toBe(false);
  });
});

describe("hasRoomFor", () => {
  it("allows the write when no estimate is available", async () => {
    stubStorage({});
    expect(await hasRoomFor(1_000_000_000)).toBe(true);
  });

  it("allows when free space clears the write plus the safety margin", async () => {
    // free = 100k, need 10k * 1.5 = 15k
    stubStorage({
      estimate: async () => ({ usage: 0, quota: 100_000 }),
    });
    expect(await hasRoomFor(10_000)).toBe(true);
  });

  it("rejects when free space is under the write plus the safety margin", async () => {
    // free = 12k, need 10k * 1.5 = 15k
    stubStorage({
      estimate: async () => ({ usage: 88_000, quota: 100_000 }),
    });
    expect(await hasRoomFor(10_000)).toBe(false);
  });
});
