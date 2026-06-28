import { describe, expect, it, vi } from "vitest";

import * as iframeRenderer from "../iframe-renderer";
import { renderChapter } from "../chapter-renderer";
import type { ParsedChapter } from "@/services/epub/epub-types";

describe("renderChapter", () => {
  it("renders chapter content", () => {
    const renderSpy = vi
      .spyOn(iframeRenderer, "renderIframe")
      .mockImplementation(() => {});

    const iframe = document.createElement("iframe");

    const chapter: ParsedChapter = {
      id: "ch1",
      href: "text/ch1.xhtml",
      content: "<p>Chapter One</p>",
      stylesheets: [],
      assetMap: new Map(),
    };

    renderChapter(iframe, chapter);

    expect(renderSpy).toHaveBeenCalledWith(iframe, "<p>Chapter One</p>", []);
  });

  it("passes stylesheets to iframe renderer", () => {
    const renderSpy = vi
      .spyOn(iframeRenderer, "renderIframe")
      .mockImplementation(() => {});

    const iframe = document.createElement("iframe");

    const chapter: ParsedChapter = {
      id: "ch1",
      href: "text/ch1.xhtml",
      content: "<p>Test</p>",
      stylesheets: ["body { font-size: 18px; }"],
      assetMap: new Map(),
    };

    renderChapter(iframe, chapter);

    expect(renderSpy).toHaveBeenCalledWith(iframe, "<p>Test</p>", [
      "body { font-size: 18px; }",
    ]);
  });
});
