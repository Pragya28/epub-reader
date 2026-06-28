import { describe, expect, it } from "vitest";

import { renderIframe } from "../iframe-renderer";

describe("renderIframe", () => {
  it("writes chapter html to iframe srcdoc", () => {
    const iframe = document.createElement("iframe");

    renderIframe(iframe, "<p>Chapter One</p>", []);

    expect(iframe.srcdoc).toContain("Chapter One");
  });

  it("injects epub stylesheets", () => {
    const iframe = document.createElement("iframe");

    renderIframe(iframe, "<p>Hello</p>", ["body { color: red; }"]);

    expect(iframe.srcdoc).toContain("body { color: red; }");
  });

  it("creates a valid html document", () => {
    const iframe = document.createElement("iframe");

    renderIframe(iframe, "<p>Hello</p>", []);

    expect(iframe.srcdoc).toContain("<!doctype html>");
    expect(iframe.srcdoc).toContain("<html>");
    expect(iframe.srcdoc).toContain("<body>");
  });
});
