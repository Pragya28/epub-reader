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
    });
  });

  it("renders theme and font controls", () => {
    renderScreen();

    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Literata" })).toBeInTheDocument();
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

    await user.click(screen.getByRole("radio", { name: "Lora" }));

    expect(preferencesStore.getState().readerFont).toBe("lora");
  });
});
