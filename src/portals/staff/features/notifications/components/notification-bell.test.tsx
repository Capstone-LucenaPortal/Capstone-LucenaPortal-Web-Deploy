import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationBell } from "./notification-bell";

describe("NotificationBell", () => {
  it("links to the Notifications list", () => {
    render(<NotificationBell unreadCount={0} />);

    expect(screen.getByRole("link", { name: /notifications/i })).toHaveAttribute(
      "href",
      "/staff/notifications",
    );
  });

  it("shows the unread count, and names it for a screen reader", () => {
    render(<NotificationBell unreadCount={3} />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Notifications, 3 unread" }),
    ).toBeInTheDocument();
  });

  it("shows no badge at zero", () => {
    render(<NotificationBell unreadCount={0} />);

    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Notifications" })).toBeInTheDocument();
  });

  it("caps a large count rather than widening the badge", () => {
    render(<NotificationBell unreadCount={250} />);

    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Notifications, 250 unread" }),
    ).toBeInTheDocument();
  });

  it("says the count is unknown rather than showing zero when it could not be read", () => {
    render(<NotificationBell unreadCount={null} />);

    expect(screen.getByText("?")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Notifications, unread count unavailable" }),
    ).toBeInTheDocument();
  });
});
