import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PoolList } from "@/portals/responder/features/incidents/components/pool-list";
import { anIncident } from "@/portals/responder/features/incidents/lib/fixtures";
import type { Incident } from "@/portals/responder/features/incidents/types";

const NOW = new Date("2026-08-12T00:08:00.000Z");

/**
 * The ordering rule (C7) stated as data: level first, then longest-waiting.
 * `type_label` is the heading now, so each row needs a distinct one to be
 * identifiable in the assertion.
 */
const pool: Incident[] = [
  anIncident({
    id: "a",
    type_label: "Faded lane paint",
    incident_level: "low",
    submitted_at: "2026-08-11T18:00:00.000Z",
  }),
  anIncident({
    id: "b",
    type_label: "Sinkhole",
    incident_level: "critical",
    submitted_at: "2026-08-12T00:00:00.000Z",
  }),
  anIncident({
    id: "c",
    type_label: "Collapsed railing",
    incident_level: "critical",
    // Same level as the sinkhole but waiting five hours longer, so it leads.
    submitted_at: "2026-08-11T19:00:00.000Z",
  }),
  anIncident({
    id: "d",
    type_label: "Open manhole",
    incident_level: "high",
    submitted_at: "2026-08-11T20:00:00.000Z",
  }),
  anIncident({
    id: "e",
    type_label: "Reported flooding",
    incident_level: "critical",
    // Unverified is always last, whatever its level.
    is_verified: false,
    sla_armed_at: null,
    sla_due_at: null,
    submitted_at: "2026-08-11T17:00:00.000Z",
  }),
];

describe("PoolList", () => {
  it("orders verified first, higher level first, longest waiting first", () => {
    render(<PoolList incidents={pool} now={NOW} gated={false} />);

    const titles = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);

    expect(titles).toEqual([
      "Collapsed railing",
      "Sinkhole",
      "Open manhole",
      "Faded lane paint",
      "Reported flooding",
    ]);
  });

  it("breaks a tie on the citizen's wait, not time in the pool", () => {
    // SCRUM-200's open question, decided: a ticket released back to the pool
    // keeps its place. The older report leads even though it re-entered last.
    render(
      <PoolList
        incidents={[
          anIncident({
            id: "fresh",
            type_label: "Sinkhole",
            submitted_at: "2026-08-11T23:50:00.000Z",
            pooled_at: "2026-08-11T23:55:00.000Z",
          }),
          anIncident({
            id: "released",
            type_label: "Collapsed railing",
            submitted_at: "2026-08-11T20:00:00.000Z",
            pooled_at: "2026-08-12T00:06:00.000Z",
          }),
        ]}
        now={NOW}
        gated={false}
      />,
    );

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual(["Collapsed railing", "Sinkhole"]);
  });

  it("labels both sections", () => {
    render(<PoolList incidents={pool} now={NOW} gated={false} />);

    expect(screen.getByText("Verified · SLA running")).toBeInTheDocument();
    expect(
      screen.getByText("Unverified · no proof, SLA paused"),
    ).toBeInTheDocument();
  });

  it("hides a section header when that section is empty", () => {
    const verifiedOnly = pool.filter((i) => i.is_verified);

    render(<PoolList incidents={verifiedOnly} now={NOW} gated={false} />);

    expect(screen.getByText("Verified · SLA running")).toBeInTheDocument();
    expect(
      screen.queryByText("Unverified · no proof, SLA paused"),
    ).not.toBeInTheDocument();
  });

  it("keeps the clear-pool empty state reachable", () => {
    render(<PoolList incidents={[]} now={NOW} gated={false} />);

    expect(screen.getByText("Pool is clear")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  });

  it("no longer promises a push the app cannot send", () => {
    // ISO-9: a phone alert is opt-in per device (ADR 0001). Copy promising a
    // channel the responder may not have is worse than no copy.
    render(<PoolList incidents={[]} now={NOW} gated={false} />);

    expect(screen.queryByText(/push/i)).not.toBeInTheDocument();
  });
});
