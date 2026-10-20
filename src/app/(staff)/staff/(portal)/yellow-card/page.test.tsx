import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import YellowCardQueuePage from "./page";
import * as queries from "@/portals/staff/features/yellow-card/lib/queries";
import type { YellowCardQueueItem, YellowCardStatus } from "@/portals/staff/features/yellow-card/types";

// The queue's tab row renders QueueActivityBar, which calls useRouter().
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const counts: Record<YellowCardStatus, number> = {
  pending: 1,
  resubmitted: 0,
  revision_requested: 0,
  approved: 0,
  rejected: 0,
  withdrawn: 0,
};

const application: YellowCardQueueItem = {
  id: "app-1",
  reference_number: "YC-2026-000069",
  first_name: "Juan",
  middle_name: "Dizon",
  last_name: "Dela Cruz",
  suffix: null,
  barangay_name: "Ibabang Dupay",
  status: "pending",
  submitted_at: "2026-06-28T16:23:45.547482+00:00",
  due_at: "2026-06-30T16:23:45.547482+00:00",
  document_count: 1,
  deadline_state: "on_track",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("YellowCardQueuePage", () => {
  it("renders the heading and the rows the query returned", async () => {
    vi.spyOn(queries, "getYellowCardQueue").mockResolvedValue([application]);
    vi.spyOn(queries, "getYellowCardStatusCounts").mockResolvedValue(counts);

    render(await YellowCardQueuePage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Yellow Card Applications")).toBeInTheDocument();
    expect(screen.getByText("YC-2026-000069")).toBeInTheDocument();
    expect(screen.getByText("Juan Dizon Dela Cruz")).toBeInTheDocument();
  });

  it("passes the parsed status and trimmed search term down to the query", async () => {
    const queue = vi
      .spyOn(queries, "getYellowCardQueue")
      .mockResolvedValue([application]);
    vi.spyOn(queries, "getYellowCardStatusCounts").mockResolvedValue(counts);

    render(
      await YellowCardQueuePage({
        searchParams: Promise.resolve({ status: "pending", q: "  santos  " }),
      }),
    );

    expect(queue).toHaveBeenCalledWith({ status: "pending", search: "santos" });
  });

  it("falls back to the all filter when the URL carries a status that does not exist", async () => {
    const queue = vi
      .spyOn(queries, "getYellowCardQueue")
      .mockResolvedValue([application]);
    vi.spyOn(queries, "getYellowCardStatusCounts").mockResolvedValue(counts);

    render(
      await YellowCardQueuePage({
        searchParams: Promise.resolve({ status: "nonsense" }),
      }),
    );

    expect(queue).toHaveBeenCalledWith({ status: "all", search: "" });
  });
});
