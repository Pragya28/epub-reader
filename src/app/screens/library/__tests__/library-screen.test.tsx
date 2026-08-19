import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LibraryScreen } from "../library-screen";
import { ROUTES } from "@/utils/routes";
import { libraryStore } from "@/features/library/store/library-store";
import { shelvesStore } from "@/features/library/store/shelves-store";

vi.mock("@/features/library/actions/load-library", () => ({
  loadLibrary: vi.fn(async () => {}),
}));
vi.mock("@/services/storage/groupings", () => ({
  listGroupings: vi.fn(async () => []),
  getMembersForGrouping: vi.fn(async () => []),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.LIBRARY} element={<LibraryScreen />} />
        <Route path={ROUTES.LIBRARY_SHELVES} element={<LibraryScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LibraryScreen tabs", () => {
  beforeEach(() => {
    libraryStore.setState({ books: [], isLoading: false, error: null });
    shelvesStore.setState({ sortBy: "alphabetical", viewMode: "merged" });
  });

  it("shows the Books grid and marks Books active at /library", () => {
    renderAt(ROUTES.LIBRARY);

    expect(screen.getByRole("link", { name: "Books" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Shelves" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("shows the Shelves content and marks Shelves active at /library/shelves", async () => {
    renderAt(ROUTES.LIBRARY_SHELVES);

    expect(screen.getByRole("link", { name: "Shelves" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(await screen.findByText("No shelves yet")).toBeInTheDocument();
  });

  it("opens the book-grid filter sections from the Books tab", async () => {
    renderAt(ROUTES.LIBRARY);

    screen.getByRole("button", { name: "Sort and filter" }).click();

    // "Reading Status" is ambiguous here — it's both the filter section's
    // label and one of the "Sort By" chip options' labels — so this
    // asserts on a filter-only string instead.
    expect(await screen.findByText("Hide Finished Books")).toBeInTheDocument();
  });

  it("opens the Shelves sort/view sections from the Shelves tab", async () => {
    renderAt(ROUTES.LIBRARY_SHELVES);
    await screen.findByText("No shelves yet");

    screen.getByRole("button", { name: "Sort and filter" }).click();

    expect(await screen.findByText("View")).toBeInTheDocument();
    expect(screen.queryByText("Hide Finished Books")).not.toBeInTheDocument();
  });
});
