import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../error-boundary";

vi.mock("@/shared/logger/logger", () => ({
  logger: {
    child: vi.fn(() => ({ error: vi.fn() })),
  },
}));

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("boom");
  return <p>safe content</p>;
}

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("safe content")).toBeInTheDocument();
  });

  it("renders the default fallback with the error message when a child throws", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("renders a custom fallback with error and reset when provided", () => {
    render(
      <ErrorBoundary
        fallback={(error, reset) => (
          <div>
            <p>custom: {error.message}</p>
            <button onClick={reset}>custom reset</button>
          </div>
        )}
      >
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("custom: boom")).toBeInTheDocument();
  });

  it("clears the error and re-renders children after reset", async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    function Toggle() {
      return <Bomb shouldThrow={shouldThrow} />;
    }

    render(
      <ErrorBoundary
        fallback={(_error, reset) => (
          <button
            onClick={() => {
              shouldThrow = false;
              reset();
            }}
          >
            reset
          </button>
        )}
      >
        <Toggle />
      </ErrorBoundary>,
    );

    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(screen.getByText("safe content")).toBeInTheDocument();
  });
});
