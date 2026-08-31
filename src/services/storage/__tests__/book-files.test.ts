import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "../db";
import { deleteBookFile, getBookFile, saveBookFile } from "../book-files";
import { readOpfsFile } from "../opfs-files";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { createFakeOpfsDirectory, stubOpfs } from "@/tests/utils/fake-opfs";

// jsdom has no OPFS (`navigator.storage.getDirectory`), so every save/read
// here exercises the IndexedDB fallback path — which is also exactly what
// browsers without a writable OPFS (e.g. Safari) fall back to at runtime.

describe("book file store", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("falls back to IndexedDB when OPFS is unavailable", async () => {
    const blob = new Blob(["epub"]);

    await saveBookFile("1", blob);

    const stored = await getBookFile("1");

    expect(stored?.bookId).toBe("1");
    expect(await db.bookFiles.get("1")).toBeDefined();
  });

  it("reads a book already sitting in the legacy IndexedDB table", async () => {
    const blob = new Blob(["legacy epub"]);
    await db.bookFiles.put({ bookId: "legacy-1", file: blob });

    const stored = await getBookFile("legacy-1");

    expect(stored?.bookId).toBe("legacy-1");
    expect(stored?.file).toBeDefined();
  });

  it("returns undefined for a book with no stored file", async () => {
    expect(await getBookFile("missing")).toBeUndefined();
  });

  it("deletes the file from IndexedDB", async () => {
    await saveBookFile("1", new Blob(["epub"]));

    await deleteBookFile("1");

    expect(await getBookFile("1")).toBeUndefined();
  });
});

// The fallback tests above are what jsdom exercises by default. These stub
// a fake OPFS so the primary-store and lazy-migration branches — otherwise
// unreachable in this test environment — get real coverage too.
describe("book file store — OPFS available", () => {
  beforeEach(async () => {
    await resetTestDb();
    stubOpfs(createFakeOpfsDirectory());
  });

  afterEach(() => {
    stubOpfs(undefined);
  });

  it("writes to OPFS instead of IndexedDB", async () => {
    await saveBookFile("1", new Blob(["epub"]));

    expect(await db.bookFiles.get("1")).toBeUndefined();
    expect(await readOpfsFile("1")).not.toBeNull();

    const stored = await getBookFile("1");
    expect(await stored?.file.text()).toBe("epub");
  });

  it("clears a stale IndexedDB row once the write to OPFS succeeds", async () => {
    await db.bookFiles.put({ bookId: "1", file: new Blob(["stale"]) });

    await saveBookFile("1", new Blob(["fresh"]));

    expect(await db.bookFiles.get("1")).toBeUndefined();
    const migrated = await readOpfsFile("1");
    expect(await migrated?.text()).toBe("fresh");
  });

  it("lazily migrates a book already sitting in the legacy IndexedDB table", async () => {
    // fake-indexeddb doesn't structured-clone Blob content in this test
    // environment (see book-files.test.ts's original fallback tests, which
    // only assert `.file` is defined for the same reason) — so this checks
    // the migration's control flow, not byte-for-byte content survival.
    await db.bookFiles.put({
      bookId: "legacy-1",
      file: new Blob(["legacy epub"]),
    });

    const stored = await getBookFile("legacy-1");

    expect(stored?.file).toBeDefined();
    expect(await db.bookFiles.get("legacy-1")).toBeUndefined();
    expect(await readOpfsFile("legacy-1")).not.toBeNull();
  });

  it("deletes from both OPFS and IndexedDB", async () => {
    await saveBookFile("1", new Blob(["epub"]));

    await deleteBookFile("1");

    expect(await getBookFile("1")).toBeUndefined();
    expect(await readOpfsFile("1")).toBeNull();
  });
});
