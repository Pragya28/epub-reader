import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, beforeEach } from "vitest";
import { AboutBookButton } from "../about-book-button";
import { libraryStore } from "@/features/library/store/library-store";
import { resetLibraryStore } from "@/tests/utils/reset-store";
import type { StoredBook } from "@/services/storage/storage-types";

function makeBook(overrides: Partial<StoredBook> = {}): StoredBook {
  return {
    id: "book-1",
    title: "Test Book",
    author: "Test Author",
    description: "A book about testing.",
    readingTimeMinutes: 42,
    chapterCount: 10,
    createdAt: Date.now(),
    fileHash: "hash-1",
    ...overrides,
  };
}

// A coverUrl keeps BookCover on its <img> branch rather than its text-
// ornament fallback, which otherwise repeats the title/author as text and
// makes getByText ambiguous.
const coverUrl = "blob:http://localhost/cover";

function renderWithRouter(ui: ReactElement) {
  return render(
    <MemoryRouter initialEntries={["/reader/book-1"]}>
      <Routes>
        <Route path="/reader/:bookId" element={ui} />
        <Route path="/library/author/:author" element={<p>Author page</p>} />
        <Route
          path="/library/series/:groupingId"
          element={<p>Series page</p>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AboutBookButton", () => {
  beforeEach(() => {
    resetLibraryStore();
  });

  it("opens the About sheet with the book's details", async () => {
    const user = userEvent.setup();
    renderWithRouter(<AboutBookButton book={makeBook()} coverUrl={coverUrl} />);

    await user.click(screen.getByRole("button", { name: "About this book" }));

    expect(screen.getByText("Test Book")).toBeInTheDocument();
    expect(screen.getByText("Test Author")).toBeInTheDocument();
    expect(screen.getByText("A book about testing.")).toBeInTheDocument();
  });

  it("passes the given coverUrl through to the sheet's cover image", async () => {
    const user = userEvent.setup();
    renderWithRouter(<AboutBookButton book={makeBook()} coverUrl={coverUrl} />);

    await user.click(screen.getByRole("button", { name: "About this book" }));

    // The sheet portals to document.body, outside the render container —
    // alt="" also drops it from the accessibility tree, so neither
    // `container.querySelector` nor `getByRole("img")` would find it.
    expect(document.body.querySelector("img")).toHaveAttribute("src", coverUrl);
  });

  it("hides 'More by Author' when this is the only book by that author", async () => {
    libraryStore.setState({ books: [makeBook()] });
    const user = userEvent.setup();
    renderWithRouter(<AboutBookButton book={makeBook()} coverUrl={coverUrl} />);

    await user.click(screen.getByRole("button", { name: "About this book" }));

    expect(
      screen.queryByRole("button", { name: /More by Test Author/ }),
    ).not.toBeInTheDocument();
  });

  it("navigates to the author screen from 'More by Author'", async () => {
    libraryStore.setState({
      books: [makeBook(), makeBook({ id: "book-2", title: "Another Book" })],
    });
    const user = userEvent.setup();
    renderWithRouter(<AboutBookButton book={makeBook()} coverUrl={coverUrl} />);

    await user.click(screen.getByRole("button", { name: "About this book" }));
    await user.click(
      screen.getByRole("button", { name: /More by Test Author/ }),
    );

    expect(screen.getByText("Author page")).toBeInTheDocument();
  });

  it("hides 'View Series' when this is the only book in its series", async () => {
    const book = makeBook({
      seriesName: "Test Series",
      seriesIndex: 1,
      seriesGroupingId: "grouping-1",
    });
    libraryStore.setState({ books: [book] });
    const user = userEvent.setup();
    renderWithRouter(<AboutBookButton book={book} coverUrl={coverUrl} />);

    await user.click(screen.getByRole("button", { name: "About this book" }));

    expect(
      screen.queryByRole("button", { name: /View Series/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the book's position and navigates to the series screen", async () => {
    const book = makeBook({
      seriesName: "Test Series",
      seriesIndex: 2,
      seriesGroupingId: "grouping-1",
    });
    libraryStore.setState({
      books: [
        book,
        makeBook({
          id: "book-2",
          title: "Another Book",
          seriesName: "Test Series",
        }),
      ],
    });
    const user = userEvent.setup();
    renderWithRouter(<AboutBookButton book={book} coverUrl={coverUrl} />);

    await user.click(screen.getByRole("button", { name: "About this book" }));

    const seriesButton = screen.getByRole("button", {
      name: "2/2 of Test Series • View Series",
    });
    expect(seriesButton).toBeInTheDocument();

    await user.click(seriesButton);

    expect(screen.getByText("Series page")).toBeInTheDocument();
  });
});
