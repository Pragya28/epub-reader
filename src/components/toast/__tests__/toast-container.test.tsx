import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToastContainer } from "../toast-container";
import { toastStore } from "@/stores/toast-store";

describe("ToastContainer", () => {
  beforeEach(() => {
    toastStore.setState({
      toasts: [],
    });
  });

  it("renders nothing when empty", () => {
    const { container } = render(<ToastContainer />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders success toast", () => {
    toastStore.setState({
      toasts: [
        {
          id: "1",
          message: "Book imported",
          type: "success",
        },
      ],
    });

    render(<ToastContainer />);

    expect(screen.getByText("Book imported")).toBeInTheDocument();
  });

  it("renders multiple toasts", () => {
    toastStore.setState({
      toasts: [
        {
          id: "1",
          message: "Success",
          type: "success",
        },
        {
          id: "2",
          message: "Error",
          type: "error",
        },
      ],
    });

    render(<ToastContainer />);

    expect(screen.getByText("Success")).toBeInTheDocument();

    expect(screen.getByText("Error")).toBeInTheDocument();
  });
});
