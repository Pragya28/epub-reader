import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExternalLinkDialog } from "../external-link-dialog";

describe("ExternalLinkDialog", () => {
  it("renders nothing when closed", () => {
    render(
      <ExternalLinkDialog
        open={false}
        href="https://example.com"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByText("Open external link?")).not.toBeInTheDocument();
  });

  it("shows the href with the protocol stripped when open", () => {
    render(
      <ExternalLinkDialog
        open
        href="https://example.com/page"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Open external link?")).toBeInTheDocument();
    expect(screen.getByText("example.com/page")).toBeInTheDocument();
  });

  it("calls onConfirm when Open is clicked", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(
      <ExternalLinkDialog
        open
        href="https://example.com"
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenChange when Cancel is clicked", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ExternalLinkDialog
        open
        href="https://example.com"
        onConfirm={vi.fn()}
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });
});
