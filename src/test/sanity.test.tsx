import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function TestComponent() {
  return <h1>Librune</h1>;
}

describe("sanity test", () => {
  it("renders correctly", () => {
    render(<TestComponent />);

    expect(screen.getByText("Librune")).toBeInTheDocument();
  });
});
