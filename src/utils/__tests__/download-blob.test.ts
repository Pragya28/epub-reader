import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "../download-blob";

afterEach(() => vi.restoreAllMocks());

describe("downloadBlob", () => {
  it("clicks a synthesized download anchor and revokes the URL", () => {
    const createURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:fake");
    const revokeURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    downloadBlob(new Blob(["x"]), "librune-backup.zip");

    expect(createURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeURL).toHaveBeenCalledWith("blob:fake");
    expect(document.querySelector("a")).toBeNull(); // cleaned up
  });
});
