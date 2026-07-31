import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach } from "vitest";
import { ReaderToolbar } from "../reader-toolbar";
import { readerPreferencesStore } from "../../store/reader-preferences-store";

describe("ReaderToolbar", () => {
  beforeEach(() => {
    readerPreferencesStore.setState({
      fontScale: 1,
      lineHeight: 1.6,
      theme: "system",
    });
  });

  it("opens the preferences sheet and shows current values", async () => {
    const user = userEvent.setup();
    render(<ReaderToolbar />);

    await user.click(
      screen.getByRole("button", { name: "Reading preferences" }),
    );

    expect(screen.getByText("Reading Preferences")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("1.6")).toBeInTheDocument();
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

    expect(readerPreferencesStore.getState().fontScale).toBeCloseTo(1.1);
    expect(screen.getByText("110%")).toBeInTheDocument();
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

    expect(readerPreferencesStore.getState().lineHeight).toBeCloseTo(1.5);
  });

  it("switches theme when a theme button is clicked", async () => {
    const user = userEvent.setup();
    render(<ReaderToolbar />);

    await user.click(
      screen.getByRole("button", { name: "Reading preferences" }),
    );
    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(readerPreferencesStore.getState().theme).toBe("dark");
  });
});
