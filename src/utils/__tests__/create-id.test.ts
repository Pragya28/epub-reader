import { describe, expect, it } from "vitest";
import { createId } from "../create-id";

describe("createId", () => {
  it("creates unique ids", () => {
    const ids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      ids.add(createId());
    }

    expect(ids.size).toBe(100);
  });

  it("returns a non-empty string", () => {
    const id = createId();

    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("creates different ids on consecutive calls", () => {
    const first = createId();
    const second = createId();

    expect(first).not.toBe(second);
  });
});
