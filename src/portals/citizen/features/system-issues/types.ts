/**
 * A **System issue** is a problem with the portal itself, reported by a person
 * (Super-staff `CONTEXT.md`). It is never an Incident Report, which is a
 * problem in the city. ADR 0013.
 */

/** The `system_issue_category` enum (DB l128): which part of the website went wrong. */
export type SystemIssueCategory = 'yellow_card' | 'incidents' | 'lcc' | 'accounts' | 'website';

/** What the dialog hands the data module. `category` is null until one is picked. */
export interface SystemIssueSubmission {
  category: SystemIssueCategory | null;
  description: string;
  /** The page the Citizen came from, captured without asking them. */
  page: string;
  /** `navigator.userAgent`, captured without asking them. */
  userAgent: string;
}

export interface SystemIssueResult {
  /** The new System issue's id, which its screenshot is attached to. Made up in mock mode. */
  issueId: string;
  /** The trigger-assigned `SI-YYYY-NNNNNN`, or a fabricated one in mock mode. */
  referenceNumber: string;
  mode: 'live' | 'mock';
}

/**
 * The status a Citizen sees: `system_issue_display_status()`, derived by the
 * database. A resolved issue reads `closed` once its 7 days are up, and the
 * portal never works that out itself.
 */
export type SystemIssueDisplayStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

/** Why Super-staff closed it without a fix (DB enum `system_issue_close_reason`). */
export type SystemIssueCloseReason = 'not_a_system_issue' | 'duplicate';

/** One row of `my_system_issues`, as the Dashboard reads it. */
export interface MySystemIssue {
  id: string;
  referenceNumber: string;
  category: SystemIssueCategory;
  description: string;
  status: SystemIssueDisplayStatus;
  createdAt: string;
  /** Set once Super-staff resolve it, and kept after it closes by itself. */
  resolutionNote: string | null;
  /** When a resolved issue closes by itself; null in every other status. */
  closesAt: string | null;
  closeReason: SystemIssueCloseReason | null;
  closeNote: string | null;
}
