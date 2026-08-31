import { afterEach, describe, expect, it } from "vitest";

import { deleteOpfsFile, readOpfsFile, writeOpfsFile } from "../opfs-files";
import { createFakeOpfsDirectory, stubOpfs } from "@/tests/utils/fake-opfs";

afterEach(() => {
  stubOpfs(undefined);
});

describe("opfs-files — unsupported browser", () => {
  it("writeOpfsFile fails soft to false", async () => {
    stubOpfs(undefined);
    expect(await writeOpfsFile("1", new Blob(["a"]))).toBe(false);
  });

  it("readOpfsFile fails soft to null", async () => {
    stubOpfs(undefined);
    expect(await readOpfsFile("1")).toBeNull();
  });

  it("deleteOpfsFile resolves without throwing", async () => {
    stubOpfs(undefined);
    await expect(deleteOpfsFile("1")).resolves.toBeUndefined();
  });
});

describe("opfs-files — OPFS available", () => {
  it("writes a file and reads its content back", async () => {
    stubOpfs(createFakeOpfsDirectory());

    expect(await writeOpfsFile("1", new Blob(["hello"]))).toBe(true);

    const file = await readOpfsFile("1");
    expect(file).not.toBeNull();
    expect(await file!.text()).toBe("hello");
  });

  it("readOpfsFile returns null for a file that was never written", async () => {
    stubOpfs(createFakeOpfsDirectory());
    expect(await readOpfsFile("missing")).toBeNull();
  });

  it("deletes a written file", async () => {
    stubOpfs(createFakeOpfsDirectory());
    await writeOpfsFile("1", new Blob(["hello"]));

    await deleteOpfsFile("1");

    expect(await readOpfsFile("1")).toBeNull();
  });

  it("deleteOpfsFile on a file that was never written resolves without throwing", async () => {
    stubOpfs(createFakeOpfsDirectory());
    await expect(deleteOpfsFile("missing")).resolves.toBeUndefined();
  });

  it("writeOpfsFile fails soft to false when the handle has no createWritable (e.g. Safari)", async () => {
    stubOpfs(createFakeOpfsDirectory({ supportsWrite: false }));
    expect(await writeOpfsFile("1", new Blob(["hello"]))).toBe(false);
  });
});
