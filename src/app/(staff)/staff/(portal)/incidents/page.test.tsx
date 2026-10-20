import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import IncidentsQueuePage from "./page";
import * as queries from "@/portals/staff/features/incidents/lib/queries";
import * as config from "@/portals/staff/features/incidents/lib/config";
import type { IncidentQueueItem, IncidentStatus } from "@/portals/staff/features/incidents/types";

// The queue's tab row renders QueueActivityBar, which calls useRouter().
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const counts: Record<IncidentStatus, number> = {
  open: 1,
  in_pool: 0,
  in_progress: 0,
  resolved: 0,
  closed: 0,
};

const incident: IncidentQueueItem = {
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  reference_number: "INC-2026-000051",
  type_label: "Burst main",
  incident_level: "critical",
  status: "open",
  closure_reason: null,
  is_verified: false,
  barangay_name: "Cotta",
  submitted_at: "2026-08-07T06:00:00+08:00",
  sla_armed_at: null,
  sla_due_at: null,
  resolved_at: null,
  closed_at: null,
  duplicate_of: null,
  original_reference: null,
};

function stubReads() {
  const queue = vi.spyOn(queries, "getIncidentQueue").mockResolvedValue([incident]);
  vi.spyOn(queries, "getIncidentStatusCounts").mockResolvedValue(counts);
  vi.spyOn(queries, "getAtRiskCount").mockResolvedValue(2);
  vi.spyOn(config, "getAtRiskThreshold").mockResolvedValue(0.5);
  return queue;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IncidentsQueuePage", () => {
  it("renders the heading and the rows the query returned", async () => {
    stubReads();

    render(await IncidentsQueuePage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Incident Triage Queue")).toBeInTheDocument();
    expect(screen.getByText("INC-2026-000051")).toBeInTheDocument();
    expect(screen.getByText("Burst main")).toBeInTheDocument();
  });

  it("passes the parsed status and the search term down to the query", async () => {
    const queue = stubReads();

    render(
      await IncidentsQueuePage({
        searchParams: Promise.resolve({ status: "in_pool", q: "cotta" }),
      }),
    );

    expect(queue).toHaveBeenCalledWith({ status: "in_pool", search: "cotta" });
  });

  it("falls back to all when the URL carries a status the database never had", async () => {
    // `assigned` is a bookmark from the mock. It must not reach the query.
    const queue = stubReads();

    render(
      await IncidentsQueuePage({
        searchParams: Promise.resolve({ status: "assigned" }),
      }),
    );

    expect(queue).toHaveBeenCalledWith({ status: "all", search: undefined });
  });

  it("hands the at-risk count through to the summary card", async () => {
    stubReads();

    render(await IncidentsQueuePage({ searchParams: Promise.resolve({}) }));

    const card = screen.getByText("At Risk").closest("div")!;
    expect(card).toHaveTextContent("2");
  });
});
