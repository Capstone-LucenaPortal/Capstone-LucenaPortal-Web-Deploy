import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RootError from "./error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

// Guards against the page ever borrowing AccessDenied's sign-out.
const signOut = vi.fn().mockResolvedValue({});
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
}));

afterEach(() => {
  refresh.mockClear();
  signOut.mockClear();
});

// Where a failed profile read lands, from /forbidden or the (portal) layout.
describe("RootError", () => {
  it("offers a retry and leaves the session alone", () => {
    render(<RootError error={new Error("timeout")} reset={vi.fn()} />);

    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/signed out/i)).not.toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("re-runs the server render on retry", () => {
    const reset = vi.fn();
    render(<RootError error={new Error("timeout")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(refresh).toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
  });
});
