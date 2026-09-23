import { beforeEach, describe, expect, it } from "vitest";
import { Logger } from "../logger";
import { clearErrorLog, getErrorLog } from "../error-log";

describe("Logger error persistence", () => {
  beforeEach(() => {
    clearErrorLog();
  });

  it("error() records to the persistent error log even when disabled", () => {
    const logger = new Logger({ enabled: false, scope: "test-scope" });

    logger.error("something failed", new Error("boom"));

    const log = getErrorLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      scope: "test-scope",
      message: "something failed",
    });
    expect(log[0].error).toMatchObject({ name: "Error", message: "boom" });
  });

  it("error() keeps context separate from the real error, so the error slot still serializes correctly", () => {
    const logger = new Logger({ enabled: false, scope: "test-scope" });

    logger.error("uncaught render error", new Error("boom"), {
      componentStack: "at Bomb",
    });

    const [entry] = getErrorLog();
    expect(entry.error).toMatchObject({ name: "Error", message: "boom" });
    expect(entry.context).toEqual({ componentStack: "at Bomb" });
  });

  it("trace/debug/info/warn do not touch the error log", () => {
    const logger = new Logger({ enabled: true });

    logger.trace("a");
    logger.debug("b");
    logger.info("c");
    logger.warn("d");

    expect(getErrorLog()).toEqual([]);
  });
});
