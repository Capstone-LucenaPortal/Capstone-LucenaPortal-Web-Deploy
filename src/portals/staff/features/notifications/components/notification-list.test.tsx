import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NotificationList } from "./notification-list";
import type { StaffNotification } from "../types";

vi.mock("@/portals/staff/features/notifications/lib/actions", () => ({
  openNotificationAction: vi.fn(),
}));

function aNotice(overrides: Partial<StaffNotification> = {}): StaffNotification {
  return {
    id: "n-1",
    title: "YC-2026-000066 is At Risk",
    body: "Its Processing Deadline is 16 October 2026, 3:00 PM. Open the Yellow Card queue to review it.",
    createdAt: "2026-10-16T04:07:00.000+00:00",
    readAt: null,
    applicationStatus: "pending",
    ...overrides,
  };
}

describe("NotificationList", () => {
  it("renders each notice's title and body", () => {
    render(
      <NotificationList
        items={[
          aNotice({ id: "n-1", title: "YC-2026-000066 is At Risk" }),
          aNotice({ id: "n-2", title: "YC-2026-000070 is Overdue", body: "It passed." }),
        ]}
      />,
    );

    expect(screen.getByText("YC-2026-000066 is At Risk")).toBeInTheDocument();
    expect(screen.getByText("YC-2026-000070 is Overdue")).toBeInTheDocument();
    expect(screen.getByText("It passed.")).toBeInTheDocument();
  });

  it("marks an unread notice as unread, for a screen reader as well as visually", () => {
    render(
      <NotificationList
        items={[
          aNotice({ id: "unread", readAt: null }),
          aNotice({ id: "read", readAt: "2026-10-16T05:00:00.000+00:00" }),
        ]}
      />,
    );

    expect(screen.getAllByText("Unread")).toHaveLength(1);
  });

  /**
   * Opening a notice is the whole row's job: one button, named by the notice,
   * posting the notice's id. The destination is decided on the server from
   * that id, so the form carries nothing else.
   */
  it("opens a notice through a form carrying only its id", () => {
    const { container } = render(
      <NotificationList items={[aNotice({ id: "n-42" })]} />,
    );

    expect(
      screen.getByRole("button", { name: /YC-2026-000066 is At Risk/ }),
    ).toBeInTheDocument();

    const inputs = container.querySelectorAll("form input");
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toHaveAttribute("name", "notificationId");
    expect(inputs[0]).toHaveValue("n-42");
  });

  it("offers Open on a read notice too, since it still leads to its application", () => {
    render(
      <NotificationList
        items={[aNotice({ readAt: "2026-10-16T05:00:00.000+00:00" })]}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("shows the application's current status beside its notice", () => {
    render(
      <NotificationList
        items={[aNotice({ id: "n-1", applicationStatus: "approved" })]}
      />,
    );

    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Approved")).toBeInTheDocument();
  });

  it("shows no time for a notice with none", () => {
    render(
      <NotificationList
        items={[
          aNotice({
            createdAt: null,
            body: null,
            readAt: "2026-10-16T05:00:00.000+00:00",
            applicationStatus: null,
          }),
        ]}
      />,
    );

    // Title alone: no time, no "Unread", nothing invented for a missing stamp.
    expect(screen.getByRole("button")).toHaveTextContent(/^YC-2026-000066 is At Risk$/);
  });

  it("shows no status for a notice whose application it cannot see", () => {
    render(<NotificationList items={[aNotice({ applicationStatus: null })]} />);

    const row = screen.getByRole("listitem");
    expect(within(row).queryByText("Pending Review")).not.toBeInTheDocument();
  });
});
