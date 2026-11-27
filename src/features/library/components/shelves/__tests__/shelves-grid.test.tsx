import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShelvesGrid } from "../shelves-grid";

vi.mock("../../../hooks/use-shelves-screen", () => ({
  useShelvesScreen: () => ({
    isLoading: false,
    isEmpty: false,
    viewMode: "grouped",
    merged: [],
    series: [1, 2, 3].map((n) => ({ grouping: { id: `s${n}` } })),
    collections: [{ grouping: { id: "c1" } }],
  }),
}));

vi.mock("../grouping-card", () => ({ GroupingCard: () => null }));

describe("ShelvesGrid counts", () => {
  it("shows how many series and collections there are", () => {
    render(<ShelvesGrid />);

    expect(screen.getByText(/3 Series/)).toBeInTheDocument();
    expect(screen.getByText(/1 Collection$/)).toBeInTheDocument();
  });
});
