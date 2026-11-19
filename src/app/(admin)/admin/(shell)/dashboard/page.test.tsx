import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Page from "./page";

vi.mock("@/portals/admin/features/auth/lib/profile", () => ({
  getAdminProfile: async () => ({
    id: "11111111-1111-1111-1111-111111111111",
    full_name: "Maria Santos",
    email: "maria.santos@lucenacity.gov.ph",
    role: "admin",
    status: "active",
  }),
}));

// The page itself fetches its data in the browser; only its greeting's name
// comes from the server. Its own tests are in dashboard-page.test.tsx.
vi.mock("@/portals/admin/features/dashboard/components/dashboard-page", () => ({
  DashboardPage: ({ displayName }: { displayName: string }) => <p>greeting for {displayName}</p>,
}));

describe("Admin Dashboard page", () => {
  it("greets the admin by the name from the server's profile read", async () => {
    render(await Page());
    expect(screen.getByText("greeting for Maria Santos")).toBeInTheDocument();
  });
});
