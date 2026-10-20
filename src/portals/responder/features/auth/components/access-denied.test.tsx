import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AccessDenied } from "./access-denied";

const signOut = vi.fn();

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  signOut.mockResolvedValue({ error: null });
});

/** A signOut whose completion the test controls. */
function pending() {
  let settle!: (value: unknown) => void;
  signOut.mockReturnValue(
    new Promise((resolve) => {
      settle = resolve;
    }),
  );
  return () => settle({ error: null });
}

const backToSignIn = () => screen.queryByRole("link", { name: "Back to sign in" });

describe("AccessDenied", () => {
  it("signs the wrong-portal session out exactly once", async () => {
    render(<AccessDenied decision={{ kind: "wrong-portal", role: "staff" }} />);

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it("holds the exits shut while the sign-out is still in flight", () => {
    pending();

    render(<AccessDenied decision={{ kind: "deactivated" }} />);

    // The refusal itself is readable immediately — only the way out waits.
    expect(
      screen.getByText("Your account has been deactivated"),
    ).toBeInTheDocument();
    expect(backToSignIn()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Signing out…" })).toBeDisabled();
  });

  it("opens the exits once the session is actually gone", async () => {
    const finish = pending();

    render(<AccessDenied decision={{ kind: "deactivated" }} />);
    finish();

    // Clicking before this point would carry a live cookie to /responder/login,
    // where the request guard would read it and send the refused user back to
    // /responder/pool.
    await waitFor(() => expect(backToSignIn()).toHaveAttribute("href", "/responder/login"));
    expect(
      screen.queryByRole("button", { name: "Signing out…" }),
    ).not.toBeInTheDocument();
  });

  it("opens the exits even when the sign-out fails", async () => {
    // The component logs the cause on purpose; keep it out of the test output.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    signOut.mockRejectedValue(new Error("offline"));

    render(<AccessDenied decision={{ kind: "deactivated" }} />);

    // Both destinations are sign-in pages. Stranding someone on a refusal
    // screen with no working button is worse than sending them to a form.
    await waitFor(() => expect(backToSignIn()).toBeInTheDocument());
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  // Every Portal is served from one origin, so the link is internal (MRG-06).
  it("points a wrong-portal responder at their own portal", async () => {
    render(<AccessDenied decision={{ kind: "wrong-portal", role: "staff" }} />);

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Go to the Staff portal" }),
      ).toHaveAttribute("href", "/staff/login"),
    );
  });

  it("sends someone who is not an employee to the citizen portal", async () => {
    render(<AccessDenied decision={{ kind: "not-an-employee" }} />);

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Go to the citizen portal" }),
      ).toHaveAttribute("href", "/"),
    );
  });
});
