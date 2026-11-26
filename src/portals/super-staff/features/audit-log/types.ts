// Domain types for the audit-log feature.
//
// Mirrors the `audit_area` enum. `catalogs` has no rows until Portal B ships the
// catalog editors — its tab shows an empty state, which is correct, not an error.
// `calendar` (DB l70b) is written by the Holiday and Office Hours editors; it is
// empty until the calendar screen ships, for the same reason.
// `auth` (DB l79) holds Auth Events for staff-side accounts: signed in, Session
// ended, password changed, password recovery requested. Citizens produce none.
// `yellow_card` (DB l119) holds Yellow Card Revocations, written by
// `revoke_yellow_card`.
// `maintenance` (DB l125) holds Maintenance Periods added, edited, retired or
// reactivated by Super Staff from the Configuration screen.
// `system_issues` (DB l128a) holds System issues submitted, triaged, started,
// resolved or closed; each entry targets the issue (target kind `system_issue`).
export type AuditArea =
  | "accounts"
  | "configuration"
  | "catalogs"
  | "content"
  | "pii_access"
  | "calendar"
  | "auth"
  | "yellow_card"
  | "maintenance"
  | "system_issues";

export type AuditEntry = {
  id: string;
  timestamp: string; // ISO
  actor: string; // display name
  area: AuditArea;
  /** Short human summary, e.g. "Critical SLA (hours) 4 → 3". */
  change: string;
  /** The record acted upon, e.g. "Ramon Cruz". */
  target: string;
  /** The acted-upon row's id, when the entry targets a row. Histories match on
   *  this, never on the label — a rename must not orphan a history. */
  targetId: string | null;
  /** Optional structured detail for expandable rows. */
  detail?: string;
  /** Forensic Context (DB l79): the Session the entry was written under and
   *  the IP address / user agent GoTrue recorded when that Session signed in.
   *  Copied onto the row at write time, so it survives the Session ending.
   *  All null for a system entry and for every entry written before l79 —
   *  absent, never invented. */
  sessionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  /** The Reference Numbers of the applications a Yellow Card export released,
   *  in the order stored (`changes.refs`, written since DB l18). Empty for
   *  every other entry, and for an export of zero rows. */
  references: string[];
  /** The Reference Number of the report an account change returned to its
   *  department's pool (`changes.report_released`, written since DB l104 by
   *  deactivating a Responder or moving them off the role or department).
   *  Null for every other entry, and for every entry written before l104. */
  releasedReport: string | null;
};

/** A filter tab: one area, or All of them. */
export type AreaFilter = AuditArea | "all";

/** The filter tabs' counts: one per area, plus All. */
export type AreaCounts = Record<AreaFilter, number>;
