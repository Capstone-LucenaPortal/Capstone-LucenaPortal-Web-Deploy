import type { Database } from "@/shared/supabase/types";

// A System issue (Super-staff CONTEXT.md; ADR 0013): a person's report of a
// problem with the portal itself, owned by Super-staff as IT/MIS. It is never
// an Incident Report.

type Enums = Database["public"]["Enums"];

/** The part of the portal affected: System Health's section keys, plus the website in general. */
export type IssueCategory = Enums["system_issue_category"];
export type IssuePriority = Enums["system_issue_priority"];
export type CloseReason = Enums["system_issue_close_reason"];

/**
 * The status the DATABASE shows (`system_issue_display_status`), never the
 * stored one. Closed is derived — seven days after Resolved, or closed with a
 * reason — so the portal never works it out itself.
 */
export const ISSUE_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const CATEGORY_LABEL: Record<IssueCategory, string> = {
  yellow_card: "Yellow Card",
  incidents: "Incidents",
  lcc: "LCC Bookings",
  accounts: "Accounts & sign-in",
  website: "The website in general",
};
export const CATEGORIES = Object.keys(CATEGORY_LABEL) as IssueCategory[];

export const PRIORITY_LABEL: Record<IssuePriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};
/** Highest first: the order of the select, and of the queue. */
export const PRIORITIES: IssuePriority[] = ["high", "medium", "low"];

export const STATUS_LABEL: Record<IssueStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const CLOSE_REASON_LABEL: Record<CloseReason, string> = {
  not_a_system_issue: "Not a system issue",
  duplicate: "Duplicate",
};
export const CLOSE_REASONS = Object.keys(CLOSE_REASON_LABEL) as CloseReason[];

/** One System issue as `super_system_issues` hands it over. */
export type SystemIssue = {
  id: string;
  reference: string;
  createdAt: string;
  category: IssueCategory;
  description: string;
  /** The page the reporter was on; null for a report logged from an email. */
  capturedPage: string | null;
  /** The reporter's browser string; null for a report logged from an email. */
  userAgent: string | null;
  /** Null until Super-staff prioritise it. Never cleared back to null. */
  priority: IssuePriority | null;
  status: IssueStatus;
  resolvedAt: string | null;
  resolutionNote: string | null;
  /** Resolved + 7 days while the stored status is resolved; else null. */
  closesAt: string | null;
  closedAt: string | null;
  closeReason: CloseReason | null;
  closeNote: string | null;
  /** Logged by Super-staff from a helpdesk email, so no account to notify. */
  isOnBehalf: boolean;
  /** The Citizen's name, "Anonymised citizen", or the on-behalf email. */
  reporter: string;
  /** The address to reply to, on an on-behalf report only. */
  reporterEmail: string | null;
  /** The Citizen's optional screenshot in `system-issue-screenshots` (l128b), once confirmed; else null. */
  screenshotPath: string | null;
};

/** How the queue names the reporter: an on-behalf report says it came by email. */
export const reporterLabel = (issue: Pick<SystemIssue, "isOnBehalf" | "reporter">) =>
  issue.isOnBehalf ? `${issue.reporter} (by email)` : issue.reporter;

/** Where people write when they cannot sign in or sign up (SCRUM-264). */
export const HELPDESK_EMAIL = "helpdesk@lucena-city.gov.ph";

/**
 * System Health's General card (super_system_issues_summary). Open means
 * Open or In progress. Ungraded: it never changes a status (ADR 0013).
 */
export type SystemIssueSummary = {
  open: number;
  highOpen: number;
  unprioritisedOpen: number;
  /** Null when nothing is open. */
  oldestOpenAt: string | null;
};

/** Super-staff can change an issue only while it is Open or In progress. */
export const isLive = (issue: Pick<SystemIssue, "status">) =>
  issue.status === "open" || issue.status === "in_progress";
