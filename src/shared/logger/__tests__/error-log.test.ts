import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearErrorLog, getErrorLog, recordError } from "../error-log";

describe("error-log", () => {
  beforeEach(() => {
    clearErrorLog();
  });

  it("records and reads back an entry", () => {
    recordError({ scope: "test", message: "something broke" });

    const log = getErrorLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ scope: "test", message: "something broke" });
    expect(log[0].timestamp).toBeTypeOf("number");
  });

  it("serializes an Error's name/message/stack", () => {
    recordError({ message: "failed", error: new TypeError("bad value") });

    const [entry] = getErrorLog();
    expect(entry.error).toMatchObject({
      name: "TypeError",
      message: "bad value",
    });
    expect(entry.error?.stack).toBeTypeOf("string");
  });

  it("serializes a non-Error value without throwing", () => {
    recordError({ message: "failed", error: "plain string error" });

    const [entry] = getErrorLog();
    expect(entry.error).toEqual({
      name: "Unknown",
      message: "plain string error",
    });
  });

  it("caps the log at 50 entries, dropping the oldest", () => {
    for (let i = 0; i < 55; i++) {
      recordError({ message: `error ${i}` });
    }

    const log = getErrorLog();
    expect(log).toHaveLength(50);
    expect(log[0].message).toBe("error 5");
    expect(log[49].message).toBe("error 54");
  });

  it("clearErrorLog empties the log", () => {
    recordError({ message: "one" });
    clearErrorLog();

    expect(getErrorLog()).toEqual([]);
  });

  it("fails soft when localStorage throws", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("quota", "QuotaExceededError");
      });

    expect(() => recordError({ message: "one" })).not.toThrow();

    spy.mockRestore();
  });

  it("returns an empty log when localStorage read throws", () => {
    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });

    expect(getErrorLog()).toEqual([]);

    spy.mockRestore();
  });
});
