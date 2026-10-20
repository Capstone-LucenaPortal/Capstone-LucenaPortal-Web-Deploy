import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PoolCard } from "@/portals/responder/features/incidents/components/pool-card";
import { anIncident } from "@/portals/responder/features/incidents/lib/fixtures";

/**
 * Repointed from `mockPool` at `fixtures.ts`. The assertions changed only where
 * MEANING changed — the headline (C2) and the armed instant (D2). That the rest
 * survived untouched is the evidence that props were the right seam.
 */
const NOW = new Date("2026-08-12T00:08:00.000Z");

/** 8m into a 4h promise, so 3h 52m is left — the mockup's own numbers. */
const verified = anIncident({
  sla_armed_at: "2026-08-12T00:00:00.000Z",
  sla_due_at: "2026-08-12T04:00:00.000Z",
  submitted_at: "2026-08-12T00:00:00.000Z",
});

describe("PoolCard", () => {
  it("gives a verified report a countdown, a photo count, and a claim button", () => {
    render(<PoolCard incident={verified} now={NOW} gated={false} />);

    // C2 — the headline is the incident TYPE, with the citizen's description
    // beneath it. There is no title column and there will not be one.
    expect(screen.getByText("Flooding")).toBeInTheDocument();
    expect(screen.getByText(/Knee-deep water across both lanes/)).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("8m ago")).toBeInTheDocument();
    expect(
      screen.getByText("Brgy. Ibabang Dupay · Quezon Ave. cor. Evangelista St."),
    ).toBeInTheDocument();
    expect(screen.getByText("3h 52m left")).toBeInTheDocument();
    expect(screen.getByText("4h target")).toBeInTheDocument();
    expect(screen.getByText("3 photos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim" })).toBeInTheDocument();
  });

  /**
   * SCRUM-193. The slot was a grey image-sized box with an image icon and a
   * bare count in the corner, which read as a photo that had failed to load.
   * The card shows no photo, so it claims no photo's space: a chip that says
   * how many there are, in words.
   */
  describe("photo chip", () => {
    it("names the count in words, singular for one", () => {
      render(
        <PoolCard
          incident={anIncident({ ...verified, before_photo_count: 1 })}
          now={NOW}
          gated={false}
        />,
      );

      expect(screen.getByText("1 photo")).toBeInTheDocument();
    });

    it("is absent when the citizen attached none", () => {
      render(
        <PoolCard
          incident={anIncident({ ...verified, before_photo_count: 0 })}
          now={NOW}
          gated={false}
        />,
      );

      expect(screen.queryByText(/\d+ photos?$/)).not.toBeInTheDocument();
    });
  });

  it("tells two same-type reports apart by their description", () => {
    // C2's whole reason: the sandbox seed has a deliberate damaged_road pair,
    // and the type label alone would make them identical but for the barangay.
    const { rerender } = render(
      <PoolCard
        incident={anIncident({
          type_label: "Damaged road",
          description: "Potholes along the whole block by the covered court.",
        })}
        now={NOW}
        gated={false}
      />,
    );
    expect(screen.getByText(/Potholes along the whole block/)).toBeInTheDocument();

    rerender(
      <PoolCard
        incident={anIncident({
          type_label: "Damaged road",
          description: "Shoulder washed out after the storm; one lane closed.",
        })}
        now={NOW}
        gated={false}
      />,
    );
    expect(screen.getByText(/Shoulder washed out after the storm/)).toBeInTheDocument();
  });

  it("says a missed promise is overdue rather than showing negative time", () => {
    // Armed 4h before it came due, and due 55m before NOW.
    const late = anIncident({
      sla_armed_at: "2026-08-11T19:13:00.000Z",
      sla_due_at: "2026-08-11T23:13:00.000Z",
    });

    render(<PoolCard incident={late} now={NOW} gated={false} />);

    expect(screen.getByText("55m overdue")).toBeInTheDocument();
  });

  it("links the card body at the report", () => {
    render(<PoolCard incident={verified} now={NOW} gated={false} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/responder/pool?report=00000000-0000-4000-8000-000000000001",
    );
  });

  it("runs no clock on an unverified report", () => {
    const unverified = anIncident({
      is_verified: false,
      sla_armed_at: null,
      sla_due_at: null,
      before_photo_count: 0,
    });

    render(<PoolCard incident={unverified} now={NOW} gated={false} />);

    expect(screen.getByText("Reported")).toBeInTheDocument();
    expect(screen.getByText("No photo")).toBeInTheDocument();
    expect(screen.getByText(/No clock running/)).toBeInTheDocument();
    expect(screen.queryByText(/left$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/target$/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Claim anyway" }),
    ).toBeInTheDocument();
  });

  it("relabels and disables the verified card's button while a ticket is held", () => {
    render(<PoolCard incident={verified} now={NOW} gated />);

    expect(
      screen.getByRole("button", { name: "Finish your ticket first" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Claim" }),
    ).not.toBeInTheDocument();
  });

  it("gates the unverified card the same way", () => {
    render(
      <PoolCard
        incident={anIncident({ is_verified: false, sla_due_at: null })}
        now={NOW}
        gated
      />,
    );

    expect(
      screen.getByRole("button", { name: "Finish your ticket first" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Claim anyway" }),
    ).not.toBeInTheDocument();
  });

  /**
   * SCRUM-200. The card's age is how long the ticket has been in THIS pool,
   * not how long ago the citizen filed it: INC-2026-000117 read "9m ago" after
   * 7 of those minutes had been staff triage. Timestamps are the demo's.
   */
  describe("age", () => {
    const DEMO_NOW = new Date("2026-10-01T23:22:30+08:00");
    const demoTimes = {
      submitted_at: "2026-10-01T23:13:26+08:00",
      pooled_at: "2026-10-01T23:20:22+08:00",
    };

    it("counts a verified card from when it entered the pool", () => {
      render(
        <PoolCard incident={anIncident(demoTimes)} now={DEMO_NOW} gated={false} />,
      );

      expect(screen.getByText("2m ago")).toBeInTheDocument();
      expect(screen.queryByText("9m ago")).not.toBeInTheDocument();
    });

    it("counts an unverified card the same way", () => {
      render(
        <PoolCard
          incident={anIncident({
            ...demoTimes,
            is_verified: false,
            sla_armed_at: null,
            sla_due_at: null,
          })}
          now={DEMO_NOW}
          gated={false}
        />,
      );

      expect(screen.getByText("2m ago")).toBeInTheDocument();
    });

    it("counts a released ticket from the release, not its first routing", () => {
      // Filed the day before, released back to the pool 5m ago.
      render(
        <PoolCard
          incident={anIncident({
            submitted_at: "2026-09-30T09:00:00+08:00",
            pooled_at: "2026-10-01T23:17:30+08:00",
          })}
          now={DEMO_NOW}
          gated={false}
        />,
      );

      expect(screen.getByText("5m ago")).toBeInTheDocument();
      expect(screen.queryByText("1d ago")).not.toBeInTheDocument();
    });

    it("shows no age rather than the submission's when pooled_at is missing", () => {
      render(
        <PoolCard
          incident={anIncident({ ...demoTimes, pooled_at: null })}
          now={DEMO_NOW}
          gated={false}
        />,
      );

      expect(screen.queryByText(/ago$/)).not.toBeInTheDocument();
    });
  });
});
