import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookingStatusBadge } from "./booking-status-badge";
import { STATUS_LABELS, STATUS_ORDER } from "../lib/status";

describe("BookingStatusBadge", () => {
  it("renders a label for every one of the ten real statuses", () => {
    for (const status of STATUS_ORDER) {
      const { unmount } = render(<BookingStatusBadge status={status} />);
      expect(screen.getByText(STATUS_LABELS[status])).toBeInTheDocument();
      unmount();
    }
    expect(STATUS_ORDER).toHaveLength(10);
  });

  it("reads payment_verification as Payment Under Review", () => {
    render(<BookingStatusBadge status="payment_verification" />);
    expect(screen.getByText("Payment Under Review")).toBeInTheDocument();
  });

  it("names why a cancelled booking ended", () => {
    // A booking swept for non-payment and one the organiser dropped are the
    // same colour otherwise, and the difference is the whole question of
    // whether anyone did anything wrong.
    render(
      <BookingStatusBadge status="cancelled" cancellationReason="expired_unpaid" />,
    );
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText("Expired — unpaid")).toBeInTheDocument();
  });

  it("distinguishes a staff rejection from an expiry", () => {
    render(
      <BookingStatusBadge status="cancelled" cancellationReason="rejected_by_staff" />,
    );
    expect(screen.getByText("Rejected by staff")).toBeInTheDocument();
    expect(screen.queryByText("Expired — unpaid")).not.toBeInTheDocument();
  });

  it("renders no reason when there is none", () => {
    render(<BookingStatusBadge status="cancelled" cancellationReason={null} />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("ignores a reason on a status that is not cancelled", () => {
    // cancellation_reason is null on every live booking, but a direct insert
    // can leave one behind on a row that was later revived.
    render(
      <BookingStatusBadge status="confirmed" cancellationReason="no_show" />,
    );
    expect(screen.queryByText("No show")).not.toBeInTheDocument();
  });
});
