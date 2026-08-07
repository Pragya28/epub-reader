import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReaderFrame } from "../reader-frame";

describe("ReaderFrame", () => {
  it("renders a sandboxed iframe", () => {
    render(<ReaderFrame title="Moby-Dick" />);

    const iframe = screen.getByTitle("Moby-Dick");
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe).toHaveAttribute("sandbox", "allow-same-origin");
  });

  it("forwards the ref to the iframe element", () => {
    const ref = createRef<HTMLIFrameElement>();
    render(<ReaderFrame ref={ref} title="Moby-Dick" />);

    expect(ref.current).toBeInstanceOf(HTMLIFrameElement);
  });
});
