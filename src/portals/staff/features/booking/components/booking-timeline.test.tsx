import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookingTimeline } from "./booking-timeline";
import { EVENT_LABELS } from "../lib/status";
import type { BookingEvent } from "../types";

function event(over: Partial<BookingEvent> = {}): BookingEvent {
  return {
    id: "e1",
    event_type: "submitted",
    actor_role: "citizen",
    actor_name: "Juan",
    note: null,
    created_at: "2026-08-09T15:55:20+08:00",
    ...over,
  };
}

describe("BookingTimeline", () => {
  it("labels every known event type", () => {
    // Driven from EVENT_LABELS, not from a query. Only five of the fifteen
    // appear in sandbox data, so a test that rendered what the database holds
    // would leave quoted, document_verified, document_rejected, repriced,
    // payment_rejected and completed uncovered.
    for (const [type, label] of Object.entries(EVENT_LABELS)) {
      const { unmount } = render(
        <BookingTimeline events={[event({ event_type: type })]} />,
      );
      expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
      unmount();
    }
    expect(Object.keys(EVENT_LABELS)).toHaveLength(15);
  });

  it("humanises an event type nobody has seen yet, rather than blanking", () => {
    // booking_events.event_type is text with no check constraint and no enum.
    // A new RPC can introduce a value without touching this repo, and the
    // incidents timeline never had to handle this because its column IS an
    // enum.
    render(<BookingTimeline events={[event({ event_type: "slot_released" })]} />);
    expect(screen.getByText(/Slot released/)).toBeInTheDocument();
  });

  it("renders document_rejected and repriced as two separate entries", () => {
    // review_booking(reject) writes both. Collapsing them would hide why the
    // number moved.
    render(
      <BookingTimeline
        events={[
          event({ id: "e1", event_type: "document_rejected", actor_role: "staff" }),
          event({ id: "e2", event_type: "repriced", actor_role: "system" }),
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(/Document rejected/)).toBeInTheDocument();
    expect(screen.getByText(/Repriced/)).toBeInTheDocument();
  });

  it("names the actor and their role", () => {
    render(<BookingTimeline events={[event()]} />);
    expect(screen.getByText(/Juan \(citizen\)/)).toBeInTheDocument();
  });

  it("renders a note when there is one", () => {
    render(
      <BookingTimeline
        events={[
          event({
            event_type: "cancelled",
            note: "The payment window closed with no verified downpayment.",
          }),
        ]}
      />,
    );
    expect(
      screen.getByText(/The payment window closed with no verified downpayment./),
    ).toBeInTheDocument();
  });

  it("explains an empty history rather than looking broken", () => {
    // Fifteen of the twenty-one sandbox bookings have none, because the
    // original fixtures were direct-inserted rather than submitted. Delete
    // that explanation when the old fixtures go.
    render(<BookingTimeline events={[]} />);
    expect(screen.getByText(/No history recorded/i)).toBeInTheDocument();
  });

  it("keeps the events in the order the query returned them", () => {
    // Oldest first — the order it happened in. Nothing is re-sorted here.
    render(
      <BookingTimeline
        events={[
          event({ id: "e1", event_type: "submitted" }),
          event({ id: "e2", event_type: "quoted" }),
          event({ id: "e3", event_type: "payment_submitted" }),
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Submitted");
    expect(items[1]).toHaveTextContent("Quoted");
    expect(items[2]).toHaveTextContent("Payment submitted");
  });
});
