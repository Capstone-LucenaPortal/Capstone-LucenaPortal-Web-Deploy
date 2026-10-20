import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PortalError from "./error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  refresh.mockClear();
});

// A page under the shell threw: a failed read, or a form action sent offline.
describe("PortalError", () => {
  it("renders inside the shell rather than as a page of its own", () => {
    const { container } = render(
      <PortalError error={new Error("Failed to fetch")} reset={vi.fn()} />,
    );

    // The shell already owns the one <main>.
    expect(container.querySelector("main")).toBeNull();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("re-runs the server render on retry", () => {
    const reset = vi.fn();
    render(<PortalError error={new Error("timeout")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(refresh).toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
  });
});
