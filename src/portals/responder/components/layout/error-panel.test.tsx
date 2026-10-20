import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ErrorPanel } from "./error-panel";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function setOnline(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
}

afterEach(() => {
  vi.restoreAllMocks();
  refresh.mockClear();
});

describe("ErrorPanel", () => {
  it("blames our side while connected, and offers a retry", () => {
    setOnline(true);
    const reset = vi.fn();
    render(<ErrorPanel reset={reset} />);

    expect(screen.getByRole("heading")).toHaveTextContent(/could not load this page/i);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  // An offline form submit lands here too. "Something went wrong on our side"
  // would send the responder to report a fault that is their signal.
  it("names the dropped connection instead when offline", () => {
    setOnline(false);
    render(<ErrorPanel reset={vi.fn()} />);

    expect(screen.getByRole("heading")).toHaveTextContent(/you are offline/i);
    expect(screen.queryByText(/on our side/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("retries on its own once the connection comes back", () => {
    setOnline(false);
    const reset = vi.fn();
    render(<ErrorPanel reset={reset} />);

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(reset).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not retry on its own while it stays connected", () => {
    setOnline(true);
    const reset = vi.fn();
    render(<ErrorPanel reset={reset} />);

    expect(reset).not.toHaveBeenCalled();
  });
});
