import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationList } from "@/portals/responder/features/incidents/components/notification-list";
import { anInboxEntry } from "@/portals/responder/features/incidents/lib/fixtures";

// The instant the page read off the clock: 2 PM on 12 Aug in Manila.
const NOW = new Date("2026-08-12T14:00:00+08:00");

vi.mock("@/portals/responder/features/incidents/actions", () => ({
  markNotificationRead: vi.fn(),
}));

describe("NotificationList", () => {
  it("renders one row per notification, with its title and body", () => {
    render(
      <NotificationList
        items={[
          anInboxEntry({ id: "n1", title: "New report in the pool" }),
          anInboxEntry({ id: "n2", title: "Ticket returned to the pool" }),
        ]}
        now={NOW}
      />,
    );

    expect(screen.getByText("New report in the pool")).toBeInTheDocument();
    expect(screen.getByText("Ticket returned to the pool")).toBeInTheDocument();
  });

  it("marks an unread row as unread, for a screen reader as well as visually", () => {
    render(
      <NotificationList
        items={[anInboxEntry({ id: "n1", read_at: null })]}
        now={NOW}
      />,
    );

    expect(screen.getByText("Unread")).toBeInTheDocument();
  });

  it("offers a mark-read form on an unread row only", () => {
    render(
      <NotificationList
        items={[
          anInboxEntry({ id: "unread-1", read_at: null }),
          anInboxEntry({
            id: "read-1",
            read_at: "2026-08-12T02:00:00.000Z",
          }),
        ]}
        now={NOW}
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
        items={[anInboxEntry({ id: "n-42", read_at: null })]}
        now={NOW}
      />,
    );

    expect(
      container.querySelector('input[name="notificationId"]'),
    ).toHaveValue("n-42");
  });
});

describe("NotificationList's stale arrivals", () => {
  it("never styles a stale arrival unread, even one never read", () => {
    // #138: read_at is still null -- nothing writes when a report moves.
    render(
      <NotificationList
        items={[anInboxEntry({ id: "n1", read_at: null, stale: true })]}
        now={NOW}
      />,
    );

    expect(screen.getByText("No longer in your pool")).toBeInTheDocument();
    expect(screen.queryByText("Unread")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("labels a stale arrival that was already read too", () => {
    render(
      <NotificationList
        items={[
          anInboxEntry({ id: "n1", read_at: "2026-08-12T02:00:00.000Z", stale: true }),
        ]}
        now={NOW}
      />,
    );

    expect(screen.getByText("No longer in your pool")).toBeInTheDocument();
  });
});

describe("NotificationList's timestamps", () => {
  it("dates a notification from an earlier day and leaves today's at the time", () => {
    // Issue #139: a report from three weeks ago read "12:59 AM", like tonight's.
    render(
      <NotificationList
        items={[
          anInboxEntry({ id: "old", created_at: "2026-07-22T16:59:00Z" }),
          anInboxEntry({ id: "today", created_at: "2026-08-12T01:00:00Z" }),
        ]}
        now={NOW}
      />,
    );

    expect(screen.getByText("Jul 23, 12:59 AM")).toBeInTheDocument();
    expect(screen.getByText("9:00 AM")).toBeInTheDocument();
  });
});
