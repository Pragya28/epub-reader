import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeSelector } from "../theme-selector";

describe("ThemeSelector", () => {
  it("marks the current value as pressed", () => {
    render(<ThemeSelector value="dark" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("calls onChange with the clicked option", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ThemeSelector value="system" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Light" }));

    expect(onChange).toHaveBeenCalledWith("light");
  });
});
