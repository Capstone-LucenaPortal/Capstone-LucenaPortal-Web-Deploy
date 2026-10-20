import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import NotificationsPage from "./page";
import * as queries from "@/portals/staff/features/notifications/lib/queries";

vi.mock("@/portals/staff/features/notifications/lib/actions", () => ({
  openNotificationAction: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NotificationsPage", () => {
  it("lists the notices the read returned", async () => {
    vi.spyOn(queries, "getNotifications").mockResolvedValue([
      {
        id: "n-1",
        title: "YC-2026-000070 is Overdue",
        body: "Its Processing Deadline passed at 15 October 2026, 5:00 PM.",
        createdAt: "2026-10-16T04:07:00.000+00:00",
        readAt: null,
        applicationStatus: "rejected",
      },
    ]);

    render(await NotificationsPage());

    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText("YC-2026-000070 is Overdue")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("has an empty state", async () => {
    vi.spyOn(queries, "getNotifications").mockResolvedValue([]);

    render(await NotificationsPage());

    expect(screen.getByText("No notifications")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
