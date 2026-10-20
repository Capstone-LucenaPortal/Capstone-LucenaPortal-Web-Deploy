import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModuleStatCard } from "./module-stat-card";
import type {
  YellowCardCardData,
  IncidentsCardData,
  BookingCardData,
} from "../types";

const yellowCard: YellowCardCardData = {
  module: "yellow-card",
  pending: 12,
  atRisk: 5,
  overdue: 3,
  preview: [
    { id: "1", label: "Juan Dela Cruz", tag: { text: "4d waiting", tone: "critical" } },
  ],
};

const incidents: IncidentsCardData = {
  module: "incidents",
  awaitingTriage: 7,
  critical: 2,
  high: 5,
  slaBreaches: 1,
  preview: [
    { id: "1", label: "Flooding", tag: { text: "critical", tone: "critical" } },
  ],
};

const booking: BookingCardData = {
  module: "booking",
  awaitingQuote: 4,
  paymentVerification: 2,
  // A COUNT of confirmed bookings with money owed, not a peso figure.
  balanceOutstanding: 1,
  preview: [
    { id: "1", label: "Barangay fiesta", tag: { text: "needs quote", tone: "warning" } },
  ],
};

describe("ModuleStatCard", () => {
  it("renders Yellow Card figures, preview, and a link to /yellow-card", () => {
    render(<ModuleStatCard data={yellowCard} />);

    expect(screen.getByText("Yellow Card")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view all/i })).toHaveAttribute(
      "href",
      "/staff/yellow-card"
    );
  });

  // Two figures, two colours: amber is At risk, red is Overdue, as on the queue.
  it("shows Yellow Card At risk and Overdue as separate figures in different colours", () => {
    render(<ModuleStatCard data={yellowCard} />);

    expect(screen.getByText("At risk")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("5")).toHaveClass("text-amber-600");
    expect(screen.getByText("3")).toHaveClass("text-red-600");
  });

  it("renders Incidents figures and a link to /incidents", () => {
    render(<ModuleStatCard data={incidents} />);

    expect(screen.getByText("Incidents")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    // The module's backlog, under its own name — see CONTEXT.md.
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Awaiting triage")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view all/i })).toHaveAttribute(
      "href",
      "/staff/incidents"
    );
  });

  it("renders Booking figures and a link to /booking", () => {
    render(<ModuleStatCard data={booking} />);

    expect(screen.getByText("Booking")).toBeInTheDocument();
    // The three real pipeline figures. "Prelim. approved" corresponded to no
    // database status and never did.
    expect(screen.getByText("Awaiting quote")).toBeInTheDocument();
    expect(screen.getByText("Verify payment")).toBeInTheDocument();
    expect(screen.getByText("Balance due")).toBeInTheDocument();
    expect(screen.queryByText("Prelim. approved")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view all/i })).toHaveAttribute(
      "href",
      "/staff/booking"
    );
  });
});
