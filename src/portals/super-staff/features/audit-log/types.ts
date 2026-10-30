// Domain types for the audit-log feature.
//
// Mirrors the `audit_area` enum. `catalogs` has no rows until Portal B ships the
// catalog editors — its tab shows an empty state, which is correct, not an error.
// `calendar` (DB l70b) is written by the Holiday and Office Hours editors; it is
// empty until the calendar screen ships, for the same reason.
// `auth` (DB l79) holds Auth Events for staff-side accounts: signed in, Session
// ended, password changed, password recovery requested. Citizens produce none.
export type AuditArea =
  | "accounts"
  | "configuration"
  | "catalogs"
  | "content"
  | "pii_access"
  | "calendar"
  | "auth";

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
};
