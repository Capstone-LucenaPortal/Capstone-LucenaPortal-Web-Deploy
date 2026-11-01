// Every staff-side Portal's "Set your password" page holds a new password to
// the one shared rule (src/shared/auth/password-policy.ts), the same one the
// Citizen Portal uses. The pages are near-copies, so one table runs all four.
import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminAcceptInvitePage from "@/app/(admin)/admin/accept-invite/page";
import StaffAcceptInvitePage from "@/app/(staff)/staff/(auth)/accept-invite/page";
import SuperStaffAcceptInvitePage from "@/app/(super-staff)/super-staff/(auth)/accept-invite/page";
import ResponderAcceptInvitePage from "@/app/(responder)/responder/(auth)/accept-invite/page";
import { PASSWORD_RULES_TEXT } from "@/shared/auth/password-policy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const mockExchangeCodeForSession = vi.fn();
const mockUpdateUser = vi.fn();

// vi.mock's first argument must be a relative path, not the `@/...` alias —
// see src/portals/admin/features/auth/hooks/use-auth.test.tsx for why.
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      updateUser: mockUpdateUser,
    },
  }),
}));

const PAGES = [
  { portal: "Admin", path: "/admin/accept-invite", Page: AdminAcceptInvitePage },
  { portal: "Staff", path: "/staff/accept-invite", Page: StaffAcceptInvitePage },
  { portal: "Super Staff", path: "/super-staff/accept-invite", Page: SuperStaffAcceptInvitePage },
  { portal: "Responder", path: "/responder/accept-invite", Page: ResponderAcceptInvitePage },
];

describe.each(PAGES)("$portal accept-invite password rule", ({ path, Page }) => {
  beforeEach(() => {
    mockExchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
    mockUpdateUser.mockReset().mockResolvedValue({ error: null });
    window.history.replaceState({}, "", `${path}?code=good-code`);
  });

  async function submit(password: string) {
    const user = userEvent.setup({ delay: null });
    render(<Page />);
    await screen.findByText("Set your password");

    await user.type(screen.getByLabelText("New password"), password);
    await user.type(screen.getByLabelText("Confirm password"), password);
    await user.click(screen.getByRole("button", { name: "Set password and continue" }));
  }

  it("shows the rule under the New password field before anything is typed", async () => {
    render(<Page />);
    await screen.findByText("Set your password");

    expect(screen.getByText(PASSWORD_RULES_TEXT)).toBeInTheDocument();
  });

  it.each([
    ["abcdefgh", "Password must include at least one number."],
    ["12345678", "Password must include at least one letter."],
    ["a1".repeat(36) + "a", "Password must be 72 characters or fewer."],
    ["abc1", "Password must be at least 8 characters."],
  ])("refuses %s without calling updateUser", async (password, message) => {
    await submit(password);

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("sends a password that meets the rule to updateUser", async () => {
    await submit("lucena2026");

    await waitFor(() =>
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "lucena2026" }),
    );
  });
});
