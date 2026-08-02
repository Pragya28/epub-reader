import { beforeEach, describe, expect, it } from "vitest";

import { db } from "../db";
import { deleteBookFile, getBookFile, saveBookFile } from "../book-files";
import { resetTestDb } from "@/tests/utils/reset-test-db";

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
