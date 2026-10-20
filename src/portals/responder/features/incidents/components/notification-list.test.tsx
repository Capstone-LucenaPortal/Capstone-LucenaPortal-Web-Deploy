import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationList } from "@/portals/responder/features/incidents/components/notification-list";
import { aNotification } from "@/portals/responder/features/incidents/lib/fixtures";

vi.mock("@/portals/responder/features/incidents/actions", () => ({
  markNotificationRead: vi.fn(),
}));

describe("NotificationList", () => {
  it("renders one row per notification, with its title and body", () => {
    render(
      <NotificationList
        items={[
          aNotification({ id: "n1", title: "New report in the pool" }),
          aNotification({ id: "n2", title: "Ticket returned to the pool" }),
        ]}
      />,
    );

    expect(screen.getByText("New report in the pool")).toBeInTheDocument();
    expect(screen.getByText("Ticket returned to the pool")).toBeInTheDocument();
  });

  it("marks an unread row as unread, for a screen reader as well as visually", () => {
    render(
      <NotificationList
        items={[aNotification({ id: "n1", read_at: null })]}
      />,
    );

    expect(screen.getByText("Unread")).toBeInTheDocument();
  });

  it("offers a mark-read form on an unread row only", () => {
    render(
      <NotificationList
        items={[
          aNotification({ id: "unread-1", read_at: null }),
          aNotification({
            id: "read-1",
            read_at: "2026-08-12T02:00:00.000Z",
          }),
        ]}
      />,
    );

    // One row is already read, so only one button should exist.
    expect(
      screen.getAllByRole("button", { name: /mark as read/i }),
    ).toHaveLength(1);
  });

  it("carries the notification id the RPC needs", () => {
    const { container } = render(
      <NotificationList
        items={[aNotification({ id: "n-42", read_at: null })]}
      />,
    );

    expect(
      container.querySelector('input[name="notificationId"]'),
    ).toHaveValue("n-42");
  });
});
