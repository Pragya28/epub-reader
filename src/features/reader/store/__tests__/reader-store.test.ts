import { describe, expect, it } from "vitest";
import { readerStore } from "../reader-store";

describe("reader store", () => {
  it("sets book correctly", () => {
    const store = readerStore.getState();

    store.setDocument({
      book: {
        id: "1",
        title: "Test Book",
      },
    } as any);

    expect(readerStore.getState().document?.book?.id).toBe("1");
  });

  it("resets state", () => {
    const store = readerStore.getState();

    store.setError("Failed");

    store.reset();

    expect(readerStore.getState().error).toBeNull();
  });
});
