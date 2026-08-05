import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FontSelector } from "../font-selector";

describe("FontSelector", () => {
  it("lists all reader fonts and marks the selected one", () => {
    render(<FontSelector value="lora" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "Literata" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    const lora = screen.getByRole("radio", { name: "Lora" });
    expect(lora).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "DM Sans" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Atkinson Hyperlegible" }),
    ).toBeInTheDocument();
  });

  it("calls onChange with the clicked font id", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FontSelector value="literata" onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "DM Sans" }));

    expect(onChange).toHaveBeenCalledWith("dmsans");
  });

  it("renders a preview in the selected font", () => {
    render(<FontSelector value="atkinson" onChange={vi.fn()} />);

    expect(
      screen.getByText("A quick brown fox jumps over the lazy dog."),
    ).toBeInTheDocument();
  });

  it("scales the preview font size with fontScale", () => {
    render(
      <FontSelector value="literata" onChange={vi.fn()} fontScale={1.2} />,
    );

    expect(
      screen.getByText("A quick brown fox jumps over the lazy dog."),
    ).toHaveStyle({ fontSize: "24px" });
  });

  it("applies lineHeight and paragraphSpacing to the preview", () => {
    render(
      <FontSelector
        value="literata"
        onChange={vi.fn()}
        lineHeight={2}
        paragraphSpacing={16}
      />,
    );

    const pangram = screen.getByText(
      "A quick brown fox jumps over the lazy dog.",
    );
    expect(pangram).toHaveStyle({ lineHeight: "2", marginBottom: "16px" });
  });
});
