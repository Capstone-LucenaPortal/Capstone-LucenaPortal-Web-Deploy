import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApplicationQueue } from "./application-queue";
import type { YellowCardQueueItem, YellowCardStatus } from "../types";

// The tab row now carries QueueActivityBar, a client component that calls
// useRouter(). These tests render outside the app router, so stub it.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

/**
 * The figure the queue hands the badge is a prop, not anything on the screen:
 * the real bar shows a label only once its poll outruns the baseline it was
 * rendered with. So wrap the bar to record the prop rather than standing in for
 * it — every test in this file still mounts the component it always did.
 */
const { countProp } = vi.hoisted(() => ({ countProp: vi.fn() }));

vi.mock("@/portals/staff/components/queue/queue-activity-bar", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/portals/staff/components/queue/queue-activity-bar")>();

  return {
    QueueActivityBar: (props: React.ComponentProps<typeof actual.QueueActivityBar>) => {
      countProp(props.count);
      return <actual.QueueActivityBar {...props} />;
    },
  };
});

beforeEach(() => {
  countProp.mockClear();
});

const counts: Record<YellowCardStatus, number> = {
  pending: 3,
  resubmitted: 3,
  revision_requested: 3,
  approved: 3,
  rejected: 9,
  withdrawn: 9,
};

function item(overrides: Partial<YellowCardQueueItem> = {}): YellowCardQueueItem {
  return {
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
    ...overrides,
  };
}

describe("ApplicationQueue", () => {
  it("renders a stat tile for every status including withdrawn", () => {
    render(
      <ApplicationQueue applications={[item()]} counts={counts} status="all" search="" />,
    );

    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
    expect(screen.getByText("Revision Requested")).toBeInTheDocument();
  });

  it("lists the applications it is given, with the full name and barangay", () => {
    render(
      <ApplicationQueue applications={[item()]} counts={counts} status="all" search="" />,
    );

    expect(screen.getByText("YC-2026-000069")).toBeInTheDocument();
    expect(screen.getByText("Juan Dizon Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("Ibabang Dupay")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "/staff/yellow-card/app-1",
    );
  });

  it("carries the active status through the search form so a search keeps the tab", () => {
    const { container } = render(
      <ApplicationQueue applications={[item()]} counts={counts} status="pending" search="" />,
    );

    const hidden = container.querySelector('input[name="status"]');
    expect(hidden).toHaveValue("pending");
  });

  it("carries the search term into every tab link so switching tabs keeps it", () => {
    render(
      <ApplicationQueue
        applications={[item()]}
        counts={counts}
        status="all"
        search="santos"
      />,
    );

    expect(screen.getByRole("link", { name: /Approved \(3\)/ })).toHaveAttribute(
      "href",
      "/staff/yellow-card?status=approved&q=santos",
    );
  });

  /**
   * The state is the database's (l80); the queue only shows it, beside the
   * deadline it is measured against. A paused or decided application has none.
   */
  it("shows each running application's deadline state and its Processing Deadline", () => {
    render(
      <ApplicationQueue
        applications={[
          item({ id: "a", reference_number: "YC-A", deadline_state: "overdue" }),
          item({ id: "b", reference_number: "YC-B", deadline_state: "at_risk" }),
          item({
            id: "c",
            reference_number: "YC-C",
            status: "revision_requested",
            due_at: null,
            deadline_state: null,
          }),
        ]}
        counts={counts}
        status="all"
        search=""
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Deadline" })).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toHaveClass("bg-red-100");
    expect(screen.getByText("At risk")).toHaveClass("bg-yellow-100");
    // Two deadlines for two running rows: the paused one renders nothing.
    expect(screen.getAllByText(/^Due /)).toHaveLength(2);
  });

  it("shows an empty state when the server returned no rows", () => {
    render(
      <ApplicationQueue applications={[]} counts={counts} status="approved" search="zzz" />,
    );

    expect(screen.getByText("No applications match your search.")).toBeInTheDocument();
  });

  /**
   * The badge announces staff workload, so counting revision_requested — which
   * waits on the citizen — would announce work nobody can do. Six distinct
   * tallies, so a figure built from the wrong pair cannot coincidentally add up
   * to the right one.
   */
  it("hands the activity badge the pending and resubmitted tallies and nothing else", () => {
    render(
      <ApplicationQueue
        applications={[item()]}
        counts={{
          pending: 2,
          resubmitted: 5,
          revision_requested: 100,
          approved: 200,
          rejected: 400,
          withdrawn: 800,
        }}
        status="all"
        search=""
      />,
    );

    expect(countProp).toHaveBeenCalledWith(7);
  });

  it("reports the filtered count against the true total, not the page length", () => {
    render(
      <ApplicationQueue applications={[item()]} counts={counts} status="pending" search="" />,
    );

    expect(screen.getByText("Showing 1 of 30 results")).toBeInTheDocument();
  });
});
