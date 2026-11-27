import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BookCount } from "../book-count";

describe("BookCount", () => {
  it("shows only the total by default", () => {
    render(<BookCount total={3} />);
    expect(screen.getByText("3 books")).toBeInTheDocument();
  });

  it("singularises one book", () => {
    render(<BookCount total={1} />);
    expect(screen.getByText("1 book")).toBeInTheDocument();
  });

  it("shows visible / total when a visible count is given", () => {
    render(<BookCount total={40} visible={12} />);
    expect(screen.getByText("12 / 40 books")).toBeInTheDocument();
  });

  it("appends the finished count", () => {
    render(<BookCount total={40} visible={12} finished={5} />);
    expect(screen.getByText("12 / 40 books • 5 Finished")).toBeInTheDocument();
  });
});
