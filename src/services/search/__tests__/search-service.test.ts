import { describe, expect, it, beforeEach } from "vitest";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { buildIndex, ensureIndex } from "../search-service";
import { findMatches, hasIndex } from "../search-index";

describe("search-service", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("builds and queries an index for a real EPUB fixture", async () => {
    const file = await loadFixture("valid-book.epub");

    expect(await hasIndex("book-1")).toBe(false);

    await buildIndex("book-1", file);

    expect(await hasIndex("book-1")).toBe(true);

    const matches = await findMatches("chapter", "book-1");
    expect(Array.isArray(matches)).toBe(true);
  });

  it("ensureIndex skips rebuilding an existing index", async () => {
    const file = await loadFixture("valid-book.epub");

    await buildIndex("book-2", file);
    const before = await findMatches("chapter", "book-2");

    await ensureIndex("book-2", file);
    const after = await findMatches("chapter", "book-2");

    expect(after.length).toBe(before.length);
  });
});
