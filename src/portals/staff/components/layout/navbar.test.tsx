import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Navbar } from "./navbar";
import type { StaffUser } from "@/portals/staff/features/auth/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const user: StaffUser = {
  id: "staff-001",
  email: "juan.delacruz@lucenacity.gov.ph",
  full_name: "Juan Dela Cruz",
  role: "staff",
  department: "Yellow Card Office",
  assignedModules: ["yellow-card"],
  created_at: "2026-01-15T08:00:00.000Z",
};

describe("Navbar", () => {
  it("renders the staff member's name and a logout button", () => {
    render(<Navbar user={user} unreadNotifications={0} />);

    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });

  it("carries the Notifications bell with the unread count it was given", () => {
    render(<Navbar user={user} unreadNotifications={2} />);

    expect(
      screen.getByRole("link", { name: "Notifications, 2 unread" }),
    ).toHaveAttribute("href", "/staff/notifications");
  });
});
