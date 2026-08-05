import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StepperRow } from "../stepper-row";

describe("StepperRow", () => {
  it("shows the current value", () => {
    render(
      <StepperRow
        label="Margins"
        value={16}
        min={8}
        max={48}
        step={8}
        suffix="px"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("stepper-input-Margins")).toHaveValue("16");
    expect(screen.getByText("px")).toBeInTheDocument();
  });

  it("calls onChange with the incremented value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <StepperRow
        label="Margins"
        value={16}
        min={8}
        max={48}
        step={8}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Increase margins" }));

    expect(onChange).toHaveBeenCalledWith(24);
  });

  it("calls onChange with the decremented value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <StepperRow
        label="Margins"
        value={16}
        min={8}
        max={48}
        step={8}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Decrease margins" }));

    expect(onChange).toHaveBeenCalledWith(8);
  });

  it("formats the value using the provided Intl.NumberFormat options", () => {
    render(
      <StepperRow
        label="Font size"
        value={1}
        min={0.8}
        max={1.6}
        step={0.1}
        format={{ style: "percent" }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("stepper-input-Font size")).toHaveValue("100%");
  });
});
