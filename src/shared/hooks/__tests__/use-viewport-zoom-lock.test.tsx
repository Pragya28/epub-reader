import { renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { useViewportZoomLock } from "../use-viewport-zoom-lock";

function renderAt(pathname: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[pathname]}>{children}</MemoryRouter>
  );
  return renderHook(() => useViewportZoomLock(), { wrapper });
}

function viewportContent() {
  return document
    .querySelector('meta[name="viewport"]')
    ?.getAttribute("content");
}

describe("useViewportZoomLock", () => {
  beforeEach(() => {
    document.head.querySelector('meta[name="viewport"]')?.remove();
    const meta = document.createElement("meta");
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1.0";
    document.head.appendChild(meta);
  });

  it("locks zoom outside the reader", () => {
    renderAt("/library");
    expect(viewportContent()).toContain("user-scalable=no");
  });

  it("leaves zoom unlocked inside the reader", () => {
    renderAt("/reader/some-book-id");
    expect(viewportContent()).not.toContain("user-scalable=no");
  });
});
