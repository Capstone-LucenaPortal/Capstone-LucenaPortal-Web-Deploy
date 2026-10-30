import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportDetail } from "@/portals/responder/features/incidents/components/report-detail";
import { anIncident } from "@/portals/responder/features/incidents/lib/fixtures";

const NOW = new Date("2026-08-12T00:08:00.000Z");
const ARMED = "2026-08-12T00:00:00.000Z";

const verified = anIncident({
  sla_armed_at: ARMED,
  sla_due_at: "2026-08-12T04:00:00.000Z",
  submitted_at: ARMED,
});

const props = {
  now: NOW,
  gated: false,
  heldRef: null,
  routedTo: "Engineering",
  photos: [
    { id: "p1", url: "https://example.test/1.jpg" },
    { id: "p2", url: "https://example.test/2.jpg" },
    { id: "p3", url: "https://example.test/3.jpg" },
  ],
};

describe("ReportDetail", () => {
  it("states the promise, the evidence, and the routing facts", () => {
    render(<ReportDetail incident={verified} {...props} />);

    expect(
      screen.getByText("Critical · 3h 52m of the 4h promise"),
    ).toBeInTheDocument();
    // C4 — the reference renders as ISSUED: fifteen characters, not four.
    expect(screen.getByText("INC-2026-000076")).toBeInTheDocument();
    expect(screen.getByText("Flooding")).toBeInTheDocument();
    expect(
      screen.getByText(/Reported 8m ago\s*by Maria · routed by staff/),
    ).toBeInTheDocument();
    expect(screen.getByText("Citizen photos (3)")).toBeInTheDocument();
    // Visible BEFORE claiming — the point of l56c widening the read gate.
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(
      screen.getByText("Quezon Ave. cor. Evangelista St."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Brgy. Ibabang Dupay, Lucena City"),
    ).toBeInTheDocument();
    // "Routed to" is the reader's department, handed down from their session
    // rather than read from a module-level constant.
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("Roads and drainage")).toBeInTheDocument();
    // PRD §6: the promise is armed at routing, not at claim. The mockup's
    // "4h from claim" is wrong and is deliberately not reproduced.
    expect(screen.getByText("4h from routing")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Claim this incident" }),
    ).toBeInTheDocument();
    expect(screen.getByText("One tap. First claim wins.")).toBeInTheDocument();
  });

  it("phrases a missed promise as time past it", () => {
    // Armed 4h before it came due, and due 55m before NOW.
    const late = anIncident({
      sla_armed_at: "2026-08-11T19:13:00.000Z",
      sla_due_at: "2026-08-11T23:13:00.000Z",
    });

    render(<ReportDetail incident={late} {...props} />);

    expect(
      screen.getByText("Critical · 55m past the 4h promise"),
    ).toBeInTheDocument();
  });

  it("says plainly that an unverified report has no clock", () => {
    const unverified = anIncident({
      is_verified: false,
      sla_armed_at: null,
      sla_due_at: null,
      before_photo_count: 0,
    });

    render(<ReportDetail incident={unverified} {...props} photos={[]} />);

    expect(
      screen.getByText("Unverified — no clock is running on this one"),
    ).toBeInTheDocument();
    expect(screen.getByText(/No citizen photo\./)).toBeInTheDocument();
    expect(screen.getByText("Paused until verified")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Claim anyway" }),
    ).toBeInTheDocument();
  });

  // PRD §5 suspends the SLA while unverified and §6 arms it at
  // max(route, verify), so the clock claim belongs to the clock -- never to the
  // photo count. Keyed to the count, a clocked report with no citizen photo
  // denied its own running clock (issue #7, seen on INC-2026-000107).
  it("does not call a clocked report unverified just because it has no photo", () => {
    const noPhoto = { ...verified, before_photo_count: 0 };

    render(<ReportDetail incident={noPhoto} {...props} photos={[]} />);

    expect(screen.queryByText(/is unverified/)).not.toBeInTheDocument();
    expect(screen.queryByText(/clock is paused/)).not.toBeInTheDocument();
    expect(screen.getByText(/its SLA clock is running/)).toBeInTheDocument();
    // The clock it denied is still on the screen directly above it.
    expect(
      screen.getByText("Critical · 3h 52m of the 4h promise"),
    ).toBeInTheDocument();
  });

  /**
   * The inverse of the same defect, and the reason this branch asks `sla`
   * rather than is_verified. sla.ts: "Keying off `is_verified` instead would
   * let the two disagree about whether there is a deadline." A verified report
   * whose SLA never armed has no clock, so the photo notice must not claim one
   * — the Details row beside it already says "Paused until verified".
   */
  it("claims no clock on a verified report whose SLA never armed", () => {
    const verifiedNoClock = {
      ...verified,
      before_photo_count: 0,
      sla_armed_at: null,
      sla_due_at: null,
    };

    render(<ReportDetail incident={verifiedNoClock} {...props} photos={[]} />);

    expect(
      screen.queryByText(/its SLA clock is running/),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Paused until verified")).toBeInTheDocument();
  });

  it("swaps the hint for the ticket you are holding when gated", () => {
    render(
      <ReportDetail
        incident={verified}
        {...props}
        gated
        heldRef="INC-2026-000094"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Finish your ticket first" }),
    ).toBeDisabled();
    expect(
      screen.getByText("You're holding INC-2026-000094."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("One tap. First claim wins."),
    ).not.toBeInTheDocument();
  });

  /**
   * SCRUM-200. "In pool" is how long the ticket has waited in this pool; the
   * header's "Reported … ago" is the citizen's report and stays on
   * submitted_at. Timestamps are INC-2026-000117's from the demo.
   */
  describe("in-pool age", () => {
    const DEMO_NOW = new Date("2026-10-01T23:22:30+08:00");
    const demoIncident = anIncident({
      submitted_at: "2026-10-01T23:13:26+08:00",
      pooled_at: "2026-10-01T23:20:22+08:00",
    });

    it("counts In pool from pooled_at and Reported from submitted_at", () => {
      render(<ReportDetail incident={demoIncident} {...props} now={DEMO_NOW} />);

      expect(screen.getByText("2m ago · unclaimed")).toBeInTheDocument();
      expect(
        screen.getByText(/Reported 9m ago\s*by Maria · routed by staff/),
      ).toBeInTheDocument();
    });

    it("counts a released ticket from the release", () => {
      const released = anIncident({
        submitted_at: "2026-09-30T09:00:00+08:00",
        pooled_at: "2026-10-01T23:17:30+08:00",
      });

      render(<ReportDetail incident={released} {...props} now={DEMO_NOW} />);

      expect(screen.getByText("5m ago · unclaimed")).toBeInTheDocument();
      expect(screen.getByText(/Reported 1d ago/)).toBeInTheDocument();
    });

    it("says only unclaimed when pooled_at is missing", () => {
      render(
        <ReportDetail
          incident={{ ...demoIncident, pooled_at: null }}
          {...props}
          now={DEMO_NOW}
        />,
      );

      expect(screen.getByText("unclaimed")).toBeInTheDocument();
    });
  });
});
