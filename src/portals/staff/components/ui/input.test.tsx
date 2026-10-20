import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import { Input } from "./input";

describe("Input", () => {
  it("renders with border-gray-300 and focus-ring-lucena-blue in clean state", () => {
    render(<Input />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("border-gray-300");
    expect(input).toHaveClass("focus:ring-lucena-blue");
    expect(input).not.toHaveClass("border-red-500");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("renders with border-red-500 and focus-ring-red-500 when error is provided", () => {
    render(<Input error="Field is required" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("border-red-500");
    expect(input).toHaveClass("focus:ring-red-500");
    expect(input).not.toHaveClass("border-gray-300");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("renders error message text below the input when error is provided", () => {
    render(<Input error="Field is required" />);

    expect(screen.getByText("Field is required")).toBeInTheDocument();
  });

  it("does not render error message when error prop is not provided", () => {
    render(<Input />);

    expect(screen.queryByText(/./)).not.toBeInTheDocument();
  });

  it("forwards ref to the underlying input element", () => {
    const TestComponent = () => {
      const ref = useRef<HTMLInputElement>(null);

      return (
        <>
          <Input ref={ref} />
          <button
            onClick={() => {
              if (ref.current) {
                ref.current.focus();
              }
            }}
          >
            Focus
          </button>
        </>
      );
    };

    const { getByRole } = render(<TestComponent />);
    const input = getByRole("textbox") as HTMLInputElement;
    const focusButton = getByRole("button", { name: /focus/i });

    focusButton.click();
    expect(document.activeElement).toBe(input);
  });
});
