import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach } from "vitest";
import { ReaderToolbar } from "../reader-toolbar";
import { preferencesStore } from "@/features/preferences/store/preferences-store";

describe("ReaderToolbar", () => {
  beforeEach(() => {
    preferencesStore.setState({
      fontScale: 1,
      lineHeight: 1.6,
      margins: 16,
      paragraphSpacing: 8,
      readerFont: "literata",
      readerTheme: "system",
      applyThemeToReader: true,
    });
  });

  it("opens the preferences sheet and shows current values", async () => {
    const user = userEvent.setup();
    render(<ReaderToolbar />);

    await user.click(
      screen.getByRole("button", { name: "Reading preferences" }),
    );

    expect(screen.getByText("Reading Preferences")).toBeInTheDocument();
    expect(screen.getByTestId("stepper-input-Font size")).toHaveValue("100%");
    expect(screen.getByTestId("stepper-input-Line height")).toHaveValue("1.6");
    expect(screen.getByTestId("stepper-input-Margins")).toHaveValue("16");
    expect(screen.getByTestId("stepper-input-Paragraph spacing")).toHaveValue(
      "8",
    );
  });

  it("increases font size and updates the store", async () => {
    const user = userEvent.setup();
    render(<ReaderToolbar />);

    await user.click(
      screen.getByRole("button", { name: "Reading preferences" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Increase font size" }),
    );

    expect(preferencesStore.getState().fontScale).toBeCloseTo(1.1);
    expect(screen.getByTestId("stepper-input-Font size")).toHaveValue("110%");
  });

  it("decreases line height and updates the store", async () => {
    const user = userEvent.setup();
    render(<ReaderToolbar />);

    await user.click(
      screen.getByRole("button", { name: "Reading preferences" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Decrease line height" }),
    );

    expect(preferencesStore.getState().lineHeight).toBeCloseTo(1.5);
  });

  it("increases margins and updates the store", async () => {
    const user = userEvent.setup();
    render(<ReaderToolbar />);

    await user.click(
      screen.getByRole("button", { name: "Reading preferences" }),
    );
    await user.click(screen.getByRole("button", { name: "Increase margins" }));

    expect(preferencesStore.getState().margins).toBe(20);
  });

  it("decreases paragraph spacing and updates the store", async () => {
    const user = userEvent.setup();
    render(<ReaderToolbar />);

    await user.click(
      screen.getByRole("button", { name: "Reading preferences" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Decrease paragraph spacing" }),
    );

    expect(preferencesStore.getState().paragraphSpacing).toBe(4);
  });

  it("hides the theme control when applyThemeToReader is true", async () => {
    const user = userEvent.setup();
    render(<ReaderToolbar />);

    await user.click(
      screen.getByRole("button", { name: "Reading preferences" }),
    );

    expect(screen.queryByText("Theme")).not.toBeInTheDocument();
  });

  it("shows and switches the reader theme when applyThemeToReader is false", async () => {
    preferencesStore.setState({ applyThemeToReader: false });

    const user = userEvent.setup();
    render(<ReaderToolbar />);

    await user.click(
      screen.getByRole("button", { name: "Reading preferences" }),
    );
    expect(screen.getByText("Theme")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(preferencesStore.getState().readerTheme).toBe("dark");
  });

  it("switches the shared reader font", async () => {
    const user = userEvent.setup();
    render(<ReaderToolbar />);

    await user.click(
      screen.getByRole("button", { name: "Reading preferences" }),
    );
    await user.click(screen.getByRole("radio", { name: "Lora" }));

    expect(preferencesStore.getState().readerFont).toBe("lora");
  });
});
