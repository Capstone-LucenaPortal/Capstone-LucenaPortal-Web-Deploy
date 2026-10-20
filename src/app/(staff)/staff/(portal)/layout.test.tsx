import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PortalLayout from "./layout";
import * as profile from "@/portals/staff/features/auth/lib/profile";
import * as notifications from "@/portals/staff/features/notifications/lib/queries";

vi.mock("next/navigation", () => ({
  usePathname: () => "/staff/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: vi.fn().mockResolvedValue({}) } }),
}));

// Mock only the row. Both the gate decision and the shell's user derive from
// it, so this exercises the real gate and the real mapper. Mocking both
// instead would let them drift: the gate could be handed an active staff row
// and the shell a supervisor from another department, and the test would pass
// on a combination the database cannot produce.
//
// modules is the DATABASE spelling, not this repo's Module vocabulary.
// 'incidents' is spelled the same in both, so it is easy to forget — but a
// second module written as "yellow-card" here would be silently dropped by
// the mapper as an unknown code and read as a broken sidebar rather than a
// wrong fixture. Write "yellow_card".
const ALLOWED_ROW = {
  id: "11111111-1111-1111-1111-111111111111",
  full_name: "Juan Dela Cruz",
  email: "juan.delacruz@lucenacity.gov.ph",
  role: "staff" as const,
  modules: ["incidents"],
  is_supervisor: false,
  status: "active",
  department_label: "Yellow Card Office",
  created_at: "2026-01-15T08:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PortalLayout", () => {
  it("passes the current user's name to the navbar and their assigned modules to the sidebar", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue(ALLOWED_ROW);
    vi.spyOn(notifications, "getUnreadNotificationCount").mockResolvedValue(0);

    render(await PortalLayout({ children: <div>page content</div> }));

    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Incidents" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Yellow Card" })).not.toBeInTheDocument();
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(screen.getByText(/City Government of Lucena/)).toBeInTheDocument();
  });

  it("hands the unread Notifications count to the navbar's bell", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue(ALLOWED_ROW);
    vi.spyOn(notifications, "getUnreadNotificationCount").mockResolvedValue(4);

    render(await PortalLayout({ children: <div>page content</div> }));

    expect(
      screen.getByRole("link", { name: "Notifications, 4 unread" }),
    ).toBeInTheDocument();
  });

  it("still renders the shell when the unread count could not be read", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue(ALLOWED_ROW);
    vi.spyOn(notifications, "getUnreadNotificationCount").mockResolvedValue(null);

    render(await PortalLayout({ children: <div>page content</div> }));

    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Notifications, unread count unavailable" }),
    ).toBeInTheDocument();
  });

  it("reads no Notifications for a refused caller", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue({
      ...ALLOWED_ROW,
      role: "responder",
    });
    const count = vi.spyOn(notifications, "getUnreadNotificationCount");

    render(await PortalLayout({ children: <p>secret</p> }));

    expect(count).not.toHaveBeenCalled();
  });

  it("renders AccessDenied instead of the shell for a wrong-portal role", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue({
      ...ALLOWED_ROW,
      role: "responder",
    });

    render(await PortalLayout({ children: <p>secret</p> }));

    expect(screen.getByText(/wrong portal/i)).toBeInTheDocument();
    // The assertion that matters: the refusal must REPLACE the children, not
    // render beside them. A gate that renders the shell and the warning
    // together has leaked the page it was meant to withhold.
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  // Middleware's read succeeded and this one, a moment later, did not.
  // No verdict: it goes to the error boundary, not AccessDenied.
  it("hands a failed profile read to the error boundary instead of refusing", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockRejectedValue(new profile.ProfileReadError({ message: "timeout", code: "57014" }));

    await expect(PortalLayout({ children: <p>secret</p> })).rejects.toBeInstanceOf(
      profile.ProfileReadError,
    );
  });
});
