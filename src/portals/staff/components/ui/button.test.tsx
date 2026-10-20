import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import { Button } from "./button";

describe("Button", () => {
  it("renders primary variant with bg-lucena-blue by default", () => {
    render(<Button>Primary Button</Button>);

    const button = screen.getByRole("button", { name: /primary button/i });
    expect(button).toHaveClass("bg-lucena-blue");
    expect(button).toHaveClass("text-white");
    expect(button).toHaveClass("hover:bg-lucena-blue-dark");
  });

  it("renders primary variant with bg-lucena-blue when variant is explicitly set", () => {
    render(<Button variant="primary">Primary Button</Button>);

    const button = screen.getByRole("button", { name: /primary button/i });
    expect(button).toHaveClass("bg-lucena-blue");
  });

  it("renders secondary variant without bg-lucena-blue", () => {
    render(<Button variant="secondary">Secondary Button</Button>);

    const button = screen.getByRole("button", { name: /secondary button/i });
    expect(button).not.toHaveClass("bg-lucena-blue");
    expect(button).toHaveClass("bg-gray-100");
    expect(button).toHaveClass("text-gray-900");
  });

  it("renders destructive variant without bg-lucena-blue", () => {
    render(<Button variant="destructive">Delete Button</Button>);

    const button = screen.getByRole("button", { name: /delete button/i });
    expect(button).not.toHaveClass("bg-lucena-blue");
    expect(button).toHaveClass("bg-red-600");
    expect(button).toHaveClass("text-white");
  });

  it("renders ghost variant without bg-lucena-blue", () => {
    render(<Button variant="ghost">Ghost Button</Button>);

    const button = screen.getByRole("button", { name: /ghost button/i });
    expect(button).not.toHaveClass("bg-lucena-blue");
    expect(button).toHaveClass("text-gray-900");
  });

  it("renders all variants with focus-visible:ring-lucena-blue", () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole("button")).toHaveClass("focus-visible:ring-lucena-blue");

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole("button")).toHaveClass("focus-visible:ring-lucena-blue");

    rerender(<Button variant="destructive">Destructive</Button>);
    expect(screen.getByRole("button")).toHaveClass("focus-visible:ring-lucena-blue");

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole("button")).toHaveClass("focus-visible:ring-lucena-blue");
  });

  it("forwards ref to the underlying button element", () => {
    const TestComponent = () => {
      const ref = useRef<HTMLButtonElement>(null);

      return (
        <>
          <Button ref={ref}>Click Me</Button>
          <button
            onClick={() => {
              if (ref.current) {
                ref.current.focus();
              }
            }}
          >
            Focus Button
          </button>
        </>
      );
    };

    const { getByRole } = render(<TestComponent />);
    const button = getByRole("button", { name: /click me/i }) as HTMLButtonElement;
    const focusButton = getByRole("button", { name: /focus button/i });

    focusButton.click();
    expect(document.activeElement).toBe(button);
  });

  it("renders different sizes correctly", () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-8");
    expect(screen.getByRole("button")).toHaveClass("px-3");

    rerender(<Button size="md">Medium</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-10");
    expect(screen.getByRole("button")).toHaveClass("px-4");

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-12");
    expect(screen.getByRole("button")).toHaveClass("px-6");
  });
});
