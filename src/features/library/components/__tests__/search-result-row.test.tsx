import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SearchResultRow } from "../search-result-row";

describe("SearchResultRow", () => {
  it("renders a book-only match without chapter/snippet lines", () => {
    render(
      <SearchResultRow
        title="The Weight of Forever"
        author="Eleanor Vance"
        coverUrl={undefined}
      />,
    );
    expect(screen.getByText("The Weight of Forever")).toBeInTheDocument();
    expect(screen.getByText("Eleanor Vance")).toBeInTheDocument();
    expect(screen.queryByText(/chapter/i)).not.toBeInTheDocument();
  });

  it("renders a chapter match with the matched word highlighted", () => {
    render(
      <SearchResultRow
        title="The Alchemist's Silence"
        author="Elena Thorne"
        coverUrl={undefined}
        chapterLabel="The Golden Echo"
        snippet="the immense weight of eternity seemed"
        highlightWord="eternity"
      />,
    );
    expect(screen.getByText("The Golden Echo")).toBeInTheDocument();
    expect(screen.getByText("eternity")).toBeInTheDocument();
    expect(screen.getByText("eternity").tagName).toBe("MARK");
  });
});
