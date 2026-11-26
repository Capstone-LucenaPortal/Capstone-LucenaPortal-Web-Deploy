import { createClient } from "@/shared/supabase/client";
import { requiredColumn } from "@/portals/super-staff/lib/supabase/rows";
import { rows, singleRow } from "@/portals/super-staff/lib/supabase/select";
import type { Database } from "@/shared/supabase/types";
import {
  ISSUE_STATUSES,
  type IssueStatus,
  type SystemIssue,
  type SystemIssueSummary,
} from "../types";

type IssueRow = Pick<
  Database["public"]["Views"]["super_system_issues"]["Row"],
  | "id"
  | "reference_number"
  | "created_at"
  | "category"
  | "description"
  | "captured_page"
  | "user_agent"
  | "priority"
  | "status"
  | "resolved_at"
  | "resolution_note"
  | "closes_at"
  | "closed_at"
  | "close_reason"
  | "close_note"
  | "is_on_behalf"
  | "reporter_display"
  | "reporter_email"
  | "screenshot_path"
>;

// No stored_status: the page shows the database's derived status and never
// works Closed out itself. No audit stamps or logger: who did what is the
// History's question, read from the Audit Log.
const COLUMNS =
  "id, reference_number, created_at, category, description, captured_page, user_agent, priority, status, resolved_at, resolution_note, closes_at, closed_at, close_reason, close_note, is_on_behalf, reporter_display, reporter_email, screenshot_path";
const VIEW = "super_system_issues";
/** l128b's private bucket. The view hands over the path only. */
const SCREENSHOT_BUCKET = "system-issue-screenshots";

const isStatus = (s: string | null): s is IssueStatus =>
  s !== null && (ISSUE_STATUSES as readonly string[]).includes(s);

/**
 * A row with no id, reference, date or category can neither be listed nor
 * acted on, so it is dropped rather than defaulted. The status is text in the
 * view, not an enum: one this portal does not know is dropped rather than
 * shown as a guess, as a wrong "Open" would invite a move the database refuses.
 */
export function toSystemIssues(data: IssueRow[]): SystemIssue[] {
  return data
    .map((r) => {
      const status = r.status;
      return r.id === null ||
        r.reference_number === null ||
        r.created_at === null ||
        r.category === null ||
        !isStatus(status)
        ? null
        : {
            id: r.id,
            reference: r.reference_number,
            createdAt: r.created_at,
            category: r.category,
            description: r.description ?? "",
            capturedPage: r.captured_page,
            userAgent: r.user_agent,
            priority: r.priority,
            status,
            resolvedAt: r.resolved_at,
            resolutionNote: r.resolution_note,
            closesAt: r.closes_at,
            closedAt: r.closed_at,
            closeReason: r.close_reason,
            closeNote: r.close_note,
            isOnBehalf: requiredColumn(r.is_on_behalf, "is_on_behalf", VIEW),
            reporter: r.reporter_display ?? "",
            reporterEmail: r.reporter_email,
            // The view sets it for a confirmed screenshot only.
            screenshotPath: r.screenshot_path,
          };
    })
    .filter((i): i is SystemIssue => i !== null);
}

/**
 * Every System issue, finished ones included: the Resolved, Closed and All
 * tabs filter in the page. The view is gated to active Super-staff and answers
 * anyone else with zero rows, not an error.
 */
export async function listSystemIssues(): Promise<SystemIssue[]> {
  return toSystemIssues(
    await rows(
      createClient()
        .from(VIEW)
        .select(COLUMNS)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
    ),
  );
}

type SummaryRow = Database["public"]["Views"]["super_system_issues_summary"]["Row"];
const SUMMARY_VIEW = "super_system_issues_summary";

/**
 * The counts are count(*) in the view and never null once a row comes back;
 * the oldest date is null when nothing is open.
 */
export function toSystemIssueSummary(r: SummaryRow): SystemIssueSummary {
  return {
    open: requiredColumn(r.open_count, "open_count", SUMMARY_VIEW),
    highOpen: requiredColumn(r.high_open_count, "high_open_count", SUMMARY_VIEW),
    unprioritisedOpen: requiredColumn(
      r.unprioritised_open_count,
      "unprioritised_open_count",
      SUMMARY_VIEW,
    ),
    oldestOpenAt: r.oldest_open_at,
  };
}

/**
 * One row for System Health's General card, where open means Open or In
 * progress (the queue's Needs attention). The gate sits outside the
 * aggregate, so anyone but an active Super-staff gets no row: `.single()`
 * reads that as a refused gate.
 */
export async function getSystemIssueSummary(): Promise<SystemIssueSummary> {
  return toSystemIssueSummary(
    await singleRow(
      createClient()
        .from(SUMMARY_VIEW)
        .select("open_count, high_open_count, unprioritised_open_count, oldest_open_at")
        .single(),
    ),
  );
}

/**
 * The Citizen's screenshot, read with the Super-staff session: the bucket lets
 * an aal2 Super Staff read it and nobody else outside its reporter. Downloaded
 * rather than signed, so no bearer URL to the object leaves this tab.
 */
export async function loadSystemIssueScreenshot(path: string): Promise<Blob> {
  const { data, error } = await createClient().storage.from(SCREENSHOT_BUCKET).download(path);
  if (error || !data) throw error ?? new Error(`No screenshot at ${path}`);
  return data;
}
