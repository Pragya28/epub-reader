import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TocDrawer } from "../toc-drawer";
import type { TocItem } from "@/services/epub/epub-types";

function makeItem(
  label: string,
  chapterIndex: number,
  children: TocItem[] = [],
): TocItem {
  return { label, href: `${label}.xhtml`, chapterIndex, children };
}

describe("TocDrawer", () => {
  it("disables the trigger when the toc is empty", () => {
    render(
      <TocDrawer toc={[]} currentChapterIndex={0} onItemClick={vi.fn()} />,
    );

    expect(
      screen.getByRole("button", { name: "Table of contents" }),
    ).toBeDisabled();
  });

  it("lists flattened toc entries, including nested children, when opened", async () => {
    const toc = [
      makeItem("Chapter 1", 0, [makeItem("Section 1.1", 1)]),
      makeItem("Chapter 2", 2),
    ];
    const user = userEvent.setup();

    render(
      <TocDrawer toc={toc} currentChapterIndex={0} onItemClick={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Table of contents" }));

    expect(screen.getByText("Chapter 1")).toBeInTheDocument();
    expect(screen.getByText("Section 1.1")).toBeInTheDocument();
    expect(screen.getByText("Chapter 2")).toBeInTheDocument();
  });

  it("calls onItemClick with the clicked navigable item", async () => {
    const onItemClick = vi.fn();
    const toc = [makeItem("Chapter 1", 0)];
    const user = userEvent.setup();

    render(
      <TocDrawer toc={toc} currentChapterIndex={0} onItemClick={onItemClick} />,
    );

    await user.click(screen.getByRole("button", { name: "Table of contents" }));
    await user.click(screen.getByText("Chapter 1"));

    expect(onItemClick).toHaveBeenCalledWith(toc[0]);
  });

  it("disables entries whose chapterIndex is unresolved", async () => {
    const toc = [makeItem("Unresolved", -1)];
    const user = userEvent.setup();

    render(
      <TocDrawer toc={toc} currentChapterIndex={0} onItemClick={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Table of contents" }));

    expect(screen.getByText("Unresolved").closest("button")).toBeDisabled();
  });
});
