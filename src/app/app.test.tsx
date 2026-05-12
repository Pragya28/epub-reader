import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import App from "./app";

describe("App", () => {
  it("renders app shell", () => {
    render(<App />);

    expect(document.body).toBeTruthy();
  });
});
