import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { IncidentQueue } from "./incident-queue";
import type { IncidentQueueItem, IncidentStatus } from "../types";

// The tab row now carries QueueActivityBar, a client component that calls
// useRouter(). These tests render outside the app router, so stub it.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

/**
 * What the queue hands the badge is props, not anything on the screen: the real
 * bar shows a label only once its poll outruns the baseline it was rendered
 * with. So wrap the bar to record the props rather than standing in for it —
 * every test in this file still mounts the component it always did.
 */
const { barProps } = vi.hoisted(() => ({ barProps: vi.fn() }));

/**
 * The fold is stubbed so it can answer something no single status tally does.
 * The tile and the badge report the same set, so they agree by arithmetic
 * while AWAITING_TRIAGE_STATUSES has one member — an assertion pinning both
 * against the same tally would pass whether either reads the fold or reaches
 * for `counts.open`, and would go on passing on the day the set grows and the
 * two figures part company. Every other test in this file runs the real fold,
 * restored below.
 */
const { awaitingTriageCount } = vi.hoisted(() => ({ awaitingTriageCount: vi.fn() }));

vi.mock("../lib/status", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/status")>();

  return { ...actual, awaitingTriageCount };
});

vi.mock("@/portals/staff/components/queue/queue-activity-bar", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/portals/staff/components/queue/queue-activity-bar")>();

  return {
    QueueActivityBar: (props: React.ComponentProps<typeof actual.QueueActivityBar>) => {
      barProps(props);
      return <actual.QueueActivityBar {...props} />;
    },
  };
});

const { awaitingTriageCount: realAwaitingTriageCount } = await vi.importActual<
  typeof import("../lib/status")
>("../lib/status");

beforeEach(() => {
  barProps.mockClear();
  // Reset, not clear: the one test that stubs a return value must not leak it
  // into the next, and neither must its call record.
  awaitingTriageCount.mockReset();
  awaitingTriageCount.mockImplementation(realAwaitingTriageCount);
});

const NOW = new Date("2026-08-07T12:00:00+08:00");

function counts(over: Partial<Record<IncidentStatus, number>> = {}) {
  return {
    open: 0,
    in_pool: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    ...over,
  } as Record<IncidentStatus, number>;
}

/**
 * Five distinct tallies, so a figure folded from the wrong statuses cannot
 * coincidentally add up to the right one — every wrong fold lands on a
 * different number.
 */
const DISTINCT_TALLIES = counts({
  open: 3,
  in_pool: 30,
  in_progress: 300,
  resolved: 3_000,
  closed: 30_000,
});

function item(over: Partial<IncidentQueueItem> = {}): IncidentQueueItem {
  return {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    reference_number: "INC-2026-000051",
    type_label: "Burst main",
    incident_level: "critical",
    status: "in_pool",
    closure_reason: null,
    is_verified: true,
    barangay_name: "Cotta",
    submitted_at: "2026-08-07T06:00:00+08:00",
    sla_armed_at: "2026-08-07T08:00:00+08:00",
    sla_due_at: "2026-08-07T16:00:00+08:00",
    resolved_at: null,
    closed_at: null,
    duplicate_of: null,
    original_reference: null,
    ...over,
  };
}

function renderQueue(props: Partial<Parameters<typeof IncidentQueue>[0]> = {}) {
  return render(
    <IncidentQueue
      incidents={[item()]}
      statusCounts={counts({ in_pool: 1 })}
      atRiskCount={0}
      activeStatus="all"
      now={NOW}
      threshold={0.5}
      {...props}
    />,
  );
}

describe("IncidentQueue", () => {
  it("shows the four summary numbers it was handed", () => {
    // The counts are global and come from SQL. The component must not recount
    // the rows it happens to be showing.
    renderQueue({
      incidents: [item()],
      statusCounts: counts({ open: 7, in_pool: 6, in_progress: 2 }),
      atRiskCount: 3,
    });

    for (const [value, label] of [
      ["7", "Awaiting Triage"],
      ["6", "In Pool · Unclaimed"],
      ["3", "At Risk"],
      ["2", "In Progress"],
    ]) {
      const card = screen.getByText(label).closest("div")!;
      expect(within(card).getByText(value)).toBeInTheDocument();
    }
  });

  it("shows both the status badge and the closure reason on a closed row", () => {
    renderQueue({
      incidents: [
        item({
          status: "closed",
          closure_reason: "expired_unverified",
          closed_at: "2026-08-07T10:00:00+08:00",
        }),
      ],
      statusCounts: counts({ closed: 1 }),
    });

    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText("Expired (Unverified)")).toBeInTheDocument();
  });

  it("links a Duplicate's row to its Original, by the Original's reference", () => {
    renderQueue({
      incidents: [
        item({
          status: "closed",
          closure_reason: "duplicate",
          closed_at: "2026-08-07T10:00:00+08:00",
          duplicate_of: "000000de-0000-4004-8000-000000000001",
          original_reference: "INC-2026-000076",
        }),
      ],
      statusCounts: counts({ closed: 1 }),
    });

    const row = screen.getByText("INC-2026-000051").closest("tr")!;
    expect(within(row).getByRole("link", { name: "INC-2026-000076" })).toHaveAttribute(
      "href",
      "/staff/incidents/000000de-0000-4004-8000-000000000001",
    );
  });

  /**
   * Every other row keeps exactly the one link it always had. Asserted as a
   * count over the row, so a stray "Duplicate of" with no target — or a link
   * built from a null id — fails here rather than reaching the screen.
   */
  it("shows nothing new on a row that is not a Duplicate", () => {
    renderQueue({
      incidents: [
        item({
          status: "closed",
          closure_reason: "invalid",
          closed_at: "2026-08-07T10:00:00+08:00",
        }),
      ],
      statusCounts: counts({ closed: 1 }),
    });

    const row = screen.getByText("INC-2026-000051").closest("tr")!;
    expect(within(row).getAllByRole("link")).toHaveLength(1);
    expect(within(row).queryByText(/Duplicate of/)).not.toBeInTheDocument();
  });

  it("dims an unverified row rather than spending a column on a badge", () => {
    renderQueue({ incidents: [item({ is_verified: false })] });

    const row = screen.getByText("INC-2026-000051").closest("tr")!;
    expect(row.className).toContain("text-gray-500");
  });

  it("marks the active tab with aria-current", () => {
    renderQueue({ activeStatus: "in_pool" });

    const tab = screen.getByRole("link", { name: /In Pool \(1\)/ });
    expect(tab).toHaveAttribute("aria-current", "page");
  });

  it("carries the search term into every tab link", () => {
    renderQueue({ activeStatus: "all", search: "cotta" });

    expect(screen.getByRole("link", { name: /^In Pool/ })).toHaveAttribute(
      "href",
      "/staff/incidents?status=in_pool&q=cotta",
    );
  });

  it("renders the empty state when the filter matched nothing", () => {
    renderQueue({ incidents: [], statusCounts: counts() });
    expect(screen.getByText("No incidents match this filter.")).toBeInTheDocument();
  });

  it("links each row to its detail page", () => {
    renderQueue();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "/staff/incidents/aaaaaaaa-0000-4000-8000-000000000001",
    );
  });

  it("labels the action Triage only while an incident is open", () => {
    const { rerender } = renderQueue({
      incidents: [item({ status: "open" })],
      statusCounts: counts({ open: 1 }),
    });
    expect(screen.getByRole("link", { name: "Triage" })).toBeInTheDocument();

    rerender(
      <IncidentQueue
        incidents={[item({ status: "resolved" })]}
        statusCounts={counts({ resolved: 1 })}
        atRiskCount={0}
        activeStatus="all"
        now={NOW}
        threshold={0.5}
      />,
    );
    expect(screen.getByRole("link", { name: "View" })).toBeInTheDocument();
  });

  /**
   * "new" rather than Booking's "more waiting": an unrouted report is genuinely
   * a fresh arrival, not work that joined the backlog because a colleague
   * moved it.
   */
  it("hands the activity badge the awaiting-triage tally, called new", () => {
    renderQueue({ statusCounts: DISTINCT_TALLIES });

    expect(barProps).toHaveBeenCalledWith(
      expect.objectContaining({ count: 3, noun: "new" }),
    );
  });

  /**
   * The count is whole-view. Sitting on Resolved must not hide the fact that
   * reports have arrived — the tab decides which rows are listed, never what
   * the badge is counting.
   */
  it("counts the whole view rather than the active tab", () => {
    renderQueue({
      activeStatus: "resolved",
      statusCounts: counts({ open: 3, resolved: 3_000 }),
    });

    expect(barProps).toHaveBeenCalledWith(
      expect.objectContaining({ count: 3, noun: "new" }),
    );
  });

  /**
   * Breach is a property of one row and already has two dedicated surfaces —
   * the At Risk card and the per-row SLA indicator. A whole-view arrival count
   * cannot point at a row, so an SLA signal in the bar would leave the number
   * ambiguous between "look at the bottom of the queue" and "look at the top".
   *
   * Asserted over the whole prop object rather than over the rendered bar: with
   * baseline and poll agreeing at first render the badge is empty, so a search
   * of the markup for an at-risk figure would pass against a bar showing
   * nothing at all. The keys are what an SLA signal would have to arrive
   * through, and nine incidents are at risk here so the figure is available to
   * leak.
   */
  it("is handed an arrival figure and nothing about SLA", () => {
    renderQueue({
      atRiskCount: 9,
      statusCounts: counts({ open: 3, in_progress: 9 }),
    });

    const props = barProps.mock.calls[0][0];
    expect(Object.keys(props).sort()).toEqual(["count", "countAction", "noun"]);
    expect(props.count).toBe(3);
  });

  /**
   * The tile and the badge's baseline are one figure, read from one line. They
   * sit inches apart on the same screen, so the day AWAITING_TRIAGE_STATUSES
   * grows they must move together or one of them is quietly lying — and a tile
   * reading `counts.open` would still type-check.
   *
   * Stubbed to answer a number none of the tallies is, so a tile reading any
   * one status shows that status's tally here and fails.
   */
  it("reads the awaiting-triage fold for the tile and the badge alike", () => {
    awaitingTriageCount.mockReturnValue(33);

    renderQueue({ statusCounts: DISTINCT_TALLIES });

    const tile = screen.getByText("Awaiting Triage").closest("div")!;
    expect(within(tile).getByText("33")).toBeInTheDocument();
    expect(barProps).toHaveBeenCalledWith(expect.objectContaining({ count: 33 }));
  });

  it("derives the SLA badge from the now and threshold it was passed", () => {
    // Armed 08:00, due 16:00; at 12:00 exactly 50% has elapsed.
    renderQueue({ threshold: 0.5 });
    expect(screen.getByText("At risk")).toBeInTheDocument();

    renderQueue({ threshold: 0.75 });
    expect(screen.getAllByText("On track").length).toBeGreaterThan(0);
  });
});
