import { Suspense } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import { lazyWithReload } from "../lazy-with-reload";

const RELOAD_FLAG = "librune:chunk-reload-attempted";

describe("lazyWithReload", () => {
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders normally when the import succeeds", async () => {
    const Lazy = lazyWithReload(() =>
      Promise.resolve({ default: () => <p>loaded</p> }),
    );

    render(
      <Suspense fallback="loading">
        <Lazy />
      </Suspense>,
    );

    expect(await screen.findByText("loaded")).toBeInTheDocument();
  });

  it("reloads once (rather than surfacing an error) on the first import failure", async () => {
    const Lazy = lazyWithReload(() =>
      Promise.reject(new Error("Failed to fetch dynamically imported module")),
    );

    render(
      <ErrorBoundary>
        <Suspense fallback="loading">
          <Lazy />
        </Suspense>
      </ErrorBoundary>,
    );

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem(RELOAD_FLAG)).toBe("1");
    // The reload promise never resolves, so the boundary never sees an
    // error — the fallback (a full reload) is the only outcome.
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("rethrows to the error boundary instead of reloading again once already retried this session", async () => {
    sessionStorage.setItem(RELOAD_FLAG, "1");
    const Lazy = lazyWithReload(() =>
      Promise.reject(new Error("Failed to fetch dynamically imported module")),
    );

    render(
      <ErrorBoundary>
        <Suspense fallback="loading">
          <Lazy />
        </Suspense>
      </ErrorBoundary>,
    );

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});
