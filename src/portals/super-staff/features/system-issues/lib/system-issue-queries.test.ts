import { describe, expect, it } from "vitest";
import { toSystemIssueSummary, toSystemIssues } from "./system-issue-queries";

type IssueRow = Parameters<typeof toSystemIssues>[0][number];

// Cast: the tests also feed values the view's types rule out (an unknown
// status, a null in a column the table declares NOT NULL).
const row = (over: Record<string, unknown> = {}): IssueRow =>
  ({
  id: "11111111-1111-1111-1111-111111111111",
  reference_number: "SI-2026-000031",
  created_at: "2026-11-26T02:00:00+00:00",
  category: "lcc",
  description: "The calendar keeps loading when I pick December.",
  captured_page: "/lcc",
  user_agent: "Mozilla/5.0 (Linux; Android 14) Chrome/131.0",
  priority: null,
  status: "open",
  resolved_at: null,
  resolution_note: null,
  closes_at: null,
  closed_at: null,
  close_reason: null,
  close_note: null,
  is_on_behalf: false,
  reporter_display: "Maria Santos",
  reporter_email: null,
  screenshot_path: null,
  ...over,
  }) as IssueRow;

describe("toSystemIssues", () => {
  it("maps an open Citizen report, not yet prioritised", () => {
    expect(toSystemIssues([row()])).toEqual([
      {
        id: "11111111-1111-1111-1111-111111111111",
        reference: "SI-2026-000031",
        createdAt: "2026-11-26T02:00:00+00:00",
        category: "lcc",
        description: "The calendar keeps loading when I pick December.",
        capturedPage: "/lcc",
        userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/131.0",
        priority: null,
        status: "open",
        resolvedAt: null,
        resolutionNote: null,
        closesAt: null,
        closedAt: null,
        closeReason: null,
        closeNote: null,
        isOnBehalf: false,
        reporter: "Maria Santos",
        reporterEmail: null,
        screenshotPath: null,
      },
    ]);
  });

  it("keeps the path of a confirmed screenshot (l128b)", () => {
    const [issue] = toSystemIssues([
      row({ has_screenshot: true, screenshot_path: "si/11111111-1111-1111-1111-111111111111/a.png" }),
    ]);

    expect(issue.screenshotPath).toBe("si/11111111-1111-1111-1111-111111111111/a.png");
  });

  it("keeps the resolution and its auto-close date, and a close reason with its note", () => {
    const [resolved, closed] = toSystemIssues([
      row({
        priority: "high",
        status: "resolved",
        resolved_at: "2026-11-24T03:00:00+00:00",
        resolution_note: "Cleared the calendar cache.",
        closes_at: "2026-12-01T03:00:00+00:00",
      }),
      row({
        id: "22222222-2222-2222-2222-222222222222",
        reference_number: "SI-2026-000030",
        status: "closed",
        closed_at: "2026-11-25T03:00:00+00:00",
        close_reason: "duplicate",
        close_note: "Same as SI-2026-000029.",
      }),
    ]);

    expect(resolved).toMatchObject({
      priority: "high",
      status: "resolved",
      resolvedAt: "2026-11-24T03:00:00+00:00",
      resolutionNote: "Cleared the calendar cache.",
      closesAt: "2026-12-01T03:00:00+00:00",
    });
    expect(closed).toMatchObject({
      status: "closed",
      closedAt: "2026-11-25T03:00:00+00:00",
      closeReason: "duplicate",
      closeNote: "Same as SI-2026-000029.",
    });
  });

  it("takes the database's derived status as it is: a resolved issue past 7 days reads Closed", () => {
    const [issue] = toSystemIssues([
      row({
        status: "closed",
        resolved_at: "2026-11-10T03:00:00+00:00",
        resolution_note: "Fixed.",
        closes_at: "2026-11-17T03:00:00+00:00",
      }),
    ]);
    expect(issue.status).toBe("closed");
  });

  it("reads an on-behalf report", () => {
    const [issue] = toSystemIssues([
      row({
        is_on_behalf: true,
        reporter_display: "juan@example.com",
        reporter_email: "juan@example.com",
        captured_page: null,
        user_agent: null,
      }),
    ]);
    expect(issue).toMatchObject({
      isOnBehalf: true,
      reporter: "juan@example.com",
      reporterEmail: "juan@example.com",
      capturedPage: null,
      userAgent: null,
    });
  });

  it("drops a row that cannot be identified, placed or shown with a status it knows", () => {
    expect(
      toSystemIssues([
        row({ id: null }),
        row({ reference_number: null }),
        row({ created_at: null }),
        row({ category: null }),
        row({ status: null }),
        row({ status: "closed_with_reason" }),
      ]),
    ).toEqual([]);
  });

  it("refuses to render a null is_on_behalf as a value", () => {
    expect(() => toSystemIssues([row({ is_on_behalf: null })])).toThrow(/is_on_behalf/);
  });
});

describe("toSystemIssueSummary", () => {
  type SummaryRow = Parameters<typeof toSystemIssueSummary>[0];

  it("reads the four figures the General card shows", () => {
    expect(
      toSystemIssueSummary({
        open_count: 7,
        high_open_count: 2,
        unprioritised_open_count: 3,
        oldest_open_at: "2026-11-20T02:00:00+00:00",
      }),
    ).toEqual({
      open: 7,
      highOpen: 2,
      unprioritisedOpen: 3,
      oldestOpenAt: "2026-11-20T02:00:00+00:00",
    });
  });

  it("has no oldest date when nothing is open", () => {
    expect(
      toSystemIssueSummary({
        open_count: 0,
        high_open_count: 0,
        unprioritised_open_count: 0,
        oldest_open_at: null,
      }),
    ).toEqual({ open: 0, highOpen: 0, unprioritisedOpen: 0, oldestOpenAt: null });
  });

  it("refuses to render a null count as 0", () => {
    const row: SummaryRow = {
      open_count: null,
      high_open_count: 0,
      unprioritised_open_count: 0,
      oldest_open_at: null,
    };
    expect(() => toSystemIssueSummary(row)).toThrow(/open_count/);
  });
});
