import { describe, expect, it } from "vitest";
import { withBookLock } from "../book-lock";

describe("withBookLock", () => {
  it("serializes concurrent calls for the same bookId", async () => {
    const order: number[] = [];

    const first = withBookLock("book-1", async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
    });
    const second = withBookLock("book-1", async () => {
      order.push(2);
    });

    await Promise.all([first, second]);
    expect(order).toEqual([1, 2]);
  });

  it("does not serialize calls for different bookIds", async () => {
    const order: string[] = [];

    const a = withBookLock("book-a", async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push("a");
    });
    const b = withBookLock("book-b", async () => {
      order.push("b");
    });

    await Promise.all([a, b]);
    expect(order).toEqual(["b", "a"]);
  });

  it("a failed operation does not block the next one for the same bookId", async () => {
    await expect(
      withBookLock("book-2", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    await expect(withBookLock("book-2", async () => "ok")).resolves.toBe("ok");
  });
});
