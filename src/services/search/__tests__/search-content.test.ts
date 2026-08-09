import { describe, expect, it, beforeEach } from "vitest";
import { resetTestDb } from "@/tests/utils/reset-test-db";
import { loadFixture } from "@/tests/utils/load-fixtures";
import { buildIndex } from "../search-service";
import { findChapterMatches } from "../search-content";
import { extractSnippet, getChapterSnippet } from "../snippet";

describe("findChapterMatches", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("ranks chapters by how many query words they matched", async () => {
    const file = await loadFixture("valid-book.epub");
    await buildIndex("book-1", file);

    const matches = await findChapterMatches("chapter", "book-1");

    expect(matches.length).toBeGreaterThan(0);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].matchedWords.length).toBeGreaterThanOrEqual(
        matches[i].matchedWords.length,
      );
    }
  });

  it("returns no matches for an unindexed word", async () => {
    const file = await loadFixture("valid-book.epub");
    await buildIndex("book-1", file);

    const matches = await findChapterMatches("zzznonexistentzzz", "book-1");
    expect(matches).toEqual([]);
  });
});

describe("extractSnippet", () => {
  it("surrounds the matched word with context and ellipses", () => {
    const html = `<p>${"padding ".repeat(20)}the target word here${" padding".repeat(20)}</p>`;
    const snippet = extractSnippet(html, "target");

    expect(snippet).toContain("target");
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
  });

  it("falls back to the start of the text when the word isn't found", () => {
    const snippet = extractSnippet("<p>no match here</p>", "missing");
    expect(snippet).toBe("no match here");
  });
});

describe("getChapterSnippet", () => {
  it("loads a real chapter and extracts a snippet", async () => {
    const file = await loadFixture("valid-book.epub");
    const snippet = await getChapterSnippet(file, 0, "chapter");
    expect(typeof snippet).toBe("string");
  });
});
