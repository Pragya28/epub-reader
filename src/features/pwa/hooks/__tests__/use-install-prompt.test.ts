import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInstallPrompt } from "../use-install-prompt";
import { resetPwaStore } from "@/tests/utils/reset-store";

function fireBeforeInstallPrompt() {
  const event = new Event("beforeinstallprompt") as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };
  event.prompt = vi.fn(() => Promise.resolve());
  event.userChoice = Promise.resolve({ outcome: "accepted" as const });
  const preventDefault = vi.spyOn(event, "preventDefault");
  window.dispatchEvent(event);
  return { event, preventDefault };
}

beforeEach(() => {
  resetPwaStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useInstallPrompt", () => {
  it("captures beforeinstallprompt and suppresses the browser default", () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);

    let preventDefault!: ReturnType<typeof vi.spyOn>;
    act(() => {
      ({ preventDefault } = fireBeforeInstallPrompt());
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(result.current.canInstall).toBe(true);
  });

  it("prompts and clears the deferred event once used", async () => {
    const { result } = renderHook(() => useInstallPrompt());

    let event!: ReturnType<typeof fireBeforeInstallPrompt>["event"];
    act(() => {
      ({ event } = fireBeforeInstallPrompt());
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(event.prompt).toHaveBeenCalled();
    expect(outcome).toBe("accepted");
    expect(result.current.canInstall).toBe(false);
  });

  it("returns 'unavailable' when no deferred prompt was captured", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    await act(async () => {
      expect(await result.current.promptInstall()).toBe("unavailable");
    });
  });

  it("persists dismissal through the pwa store", () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.installDismissed).toBe(true);
  });

  it("hides the install affordance once appinstalled fires", () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      fireBeforeInstallPrompt();
    });
    expect(result.current.canInstall).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });
});
