import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogoutButton } from "./logout-button";

const signOut = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function clickLogout() {
  await userEvent.setup().click(screen.getByRole("button", { name: /logout/i }));
}

describe("LogoutButton", () => {
  it("ends the session before navigating", async () => {
    signOut.mockResolvedValue({ error: null });
    render(<LogoutButton />);
    await clickLogout();

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith("/staff/login");
    expect(refresh).toHaveBeenCalled();
  });

  it("uses replace, never push — the portal must not be one Back away", async () => {
    signOut.mockResolvedValue({ error: null });
    render(<LogoutButton />);
    await clickLogout();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/login"));
    // A router exposing only replace/refresh means a push() call would throw.
    // This asserts the intent explicitly anyway.
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("stays put and explains when sign-out fails", async () => {
    // supabase-js keeps the local session when the revoke call fails, so the
    // cookie is still live. Bouncing to /login would show a sign-in form to
    // someone who is still signed in — the exact bug this task fixes.
    signOut.mockResolvedValue({ error: { message: "network down" } });
    render(<LogoutButton />);
    await clickLogout();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not sign you out/i,
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
