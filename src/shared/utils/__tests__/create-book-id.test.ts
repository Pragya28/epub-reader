import { describe, expect, it } from "vitest";
import { createBookId } from "../create-book-id";

describe("createBookId", () => {
  it("creates unique ids", () => {
    const ids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      ids.add(createBookId());
    }

    expect(ids.size).toBe(100);
  });

  it("returns a non-empty string", () => {
    const id = createBookId();

    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("creates different ids on consecutive calls", () => {
    const first = createBookId();
    const second = createBookId();

    expect(first).not.toBe(second);
  });
});
