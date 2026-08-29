import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstallBanner } from "../install-banner";
import { pwaStore } from "../../store/pwa-store";
import { resetPwaStore } from "@/tests/utils/reset-store";

function fireBeforeInstallPrompt() {
  const event = new Event("beforeinstallprompt") as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };
  event.prompt = vi.fn(() => Promise.resolve());
  event.userChoice = Promise.resolve({ outcome: "dismissed" as const });
  window.dispatchEvent(event);
}

beforeEach(() => {
  resetPwaStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InstallBanner", () => {
  it("stays hidden until the user's first import", () => {
    render(<InstallBanner />);
    act(() => fireBeforeInstallPrompt());
    expect(screen.queryByText("Install Librune")).not.toBeInTheDocument();
  });

  it("shows an installable prompt after the first import", () => {
    pwaStore.getState().setFirstImportDone(true);
    render(<InstallBanner />);
    act(() => fireBeforeInstallPrompt());

    expect(screen.getByText("Install Librune")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
  });

  it("does not render once dismissed", async () => {
    pwaStore.getState().setFirstImportDone(true);
    render(<InstallBanner />);
    act(() => fireBeforeInstallPrompt());

    await userEvent.click(
      screen.getByRole("button", { name: "Dismiss install prompt" }),
    );

    expect(screen.queryByText("Install Librune")).not.toBeInTheDocument();
    expect(pwaStore.getState().installDismissed).toBe(true);
  });
});
