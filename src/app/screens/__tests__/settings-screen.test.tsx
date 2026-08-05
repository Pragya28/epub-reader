import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SettingsScreen } from "../settings-screen";
import { preferencesStore } from "@/features/preferences/store/preferences-store";

function renderScreen() {
  return render(
    <MemoryRouter>
      <SettingsScreen />
    </MemoryRouter>,
  );
}

describe("SettingsScreen", () => {
  beforeEach(() => {
    preferencesStore.setState({
      theme: "system",
      applyThemeToReader: true,
      readerFont: "literata",
      fontScale: 1,
      lineHeight: 1.6,
    });
  });

  it("renders theme controls and the collapsed current typeface", () => {
    renderScreen();

    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Literata" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("expands the typeface list on click, showing all options", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Literata" }));

    expect(screen.getByRole("radio", { name: "Literata" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Lora" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "DM Sans" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Atkinson Hyperlegible" }),
    ).toBeInTheDocument();
  });

  it("updates the theme when an option is clicked", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(preferencesStore.getState().theme).toBe("dark");
  });

  it("toggles applyThemeToReader", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(
      screen.getByRole("switch", { name: "Apply theme to reader" }),
    );

    expect(preferencesStore.getState().applyThemeToReader).toBe(false);
  });

  it("updates the shared reader font", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Literata" }));
    await user.click(screen.getByRole("radio", { name: "Lora" }));

    expect(preferencesStore.getState().readerFont).toBe("lora");
  });

  it("keeps the typeface list expanded after selecting a font", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Literata" }));
    await user.click(screen.getByRole("radio", { name: "Lora" }));

    expect(screen.getByRole("radio", { name: "DM Sans" })).toBeInTheDocument();
  });

  it("increases font size and updates the store", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(
      screen.getByRole("button", { name: "Increase font size" }),
    );

    expect(preferencesStore.getState().fontScale).toBeCloseTo(1.1);
  });

  it("decreases line height and updates the store", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(
      screen.getByRole("button", { name: "Decrease line height" }),
    );

    expect(preferencesStore.getState().lineHeight).toBeCloseTo(1.5);
  });
});
