import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SettingsScreen } from "../settings-screen";
import { preferencesStore } from "@/features/preferences/store/preferences-store";
import { searchMaintenanceStore } from "@/features/library/store/search-maintenance-store";

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
      keepScreenAwake: true,
      keepScreenAwakeMinutes: 20,
    });
    searchMaintenanceStore.setState({
      status: "idle",
      progress: 0,
      failedCount: 0,
      lastRebuiltAt: null,
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

  it("triggers a search index rebuild and shows a completion state", async () => {
    // Drive startRebuild's own lifecycle directly (idle -> running -> idle
    // with a recorded lastRebuiltAt) rather than exercising the real
    // action's IndexedDB/JSZip work here — that path is covered by
    // rebuild-search-index.test.ts and search-maintenance-store.test.ts.
    let resolveRebuild!: () => void;
    const deferredRebuild = new Promise<void>((resolve) => {
      resolveRebuild = resolve;
    });
    searchMaintenanceStore.setState({
      startRebuild: () => {
        searchMaintenanceStore.setState({ status: "running", progress: 40 });
        return deferredRebuild.then(() => {
          searchMaintenanceStore.setState({
            status: "idle",
            progress: 100,
            failedCount: 0,
            lastRebuiltAt: Date.now(),
          });
        });
      },
    });

    const user = userEvent.setup();
    renderScreen();

    expect(screen.getByText("Never rebuilt")).toBeInTheDocument();

    const rebuildButton = screen.getByRole("button", {
      name: /rebuild search index/i,
    });
    await user.click(rebuildButton);

    expect(screen.getByRole("button", { name: /rebuilding/i })).toBeDisabled();

    resolveRebuild();

    await waitFor(() => {
      expect(screen.getByText(/last rebuilt:/i)).toBeInTheDocument();
    });
  });

  it("shows the screen-on limit stepper only when keep-screen-awake is on", async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(screen.getByTestId("stepper-input-Screen-on limit")).toHaveValue(
      "20",
    );

    await user.click(screen.getByRole("switch", { name: "Keep screen awake" }));

    expect(preferencesStore.getState().keepScreenAwake).toBe(false);
    expect(
      screen.queryByTestId("stepper-input-Screen-on limit"),
    ).not.toBeInTheDocument();
  });

  it("steps the screen-on limit by 5 minutes", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(
      screen.getByRole("button", { name: "Increase screen-on limit" }),
    );

    expect(preferencesStore.getState().keepScreenAwakeMinutes).toBe(25);
  });
});
