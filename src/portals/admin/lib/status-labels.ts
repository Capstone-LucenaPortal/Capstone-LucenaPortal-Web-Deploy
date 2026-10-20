// Per-feature status/level vocabulary — the enum codes each domain's data
// layer returns, and the human labels the UI shows for them.
//
// Incident status/level and Yellow Card status are ported directly from the
// Staff portal's own canonical maps
// (Staff's src/portals/admin/features/incidents/lib/status.ts and
// src/portals/admin/features/yellow-card/lib/status.ts) rather than invented here a second
// time — a Mayor reading this portal and a frontline clerk reading Staff's
// must read the same word for the same enum value. Booking status has no
// Staff sibling (Staff doesn't own Convention Center bookings), so its
// labels are Admin's own and unchanged by this port.
import type { IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import type { YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import type { BookingRow } from "@/portals/admin/features/booking/lib/bookings";

export type IncidentStatusValue = NonNullable<IncidentRow["status"]>;
export type IncidentLevelValue = NonNullable<IncidentRow["incident_level"]>;
export type YellowCardStatusValue = NonNullable<YellowCardRow["status"]>;
export type BookingStatusValue = NonNullable<BookingRow["status"]>;
export type ClosureReasonValue = NonNullable<IncidentRow["closure_reason"]>;
export type BookingCancellationReasonValue = NonNullable<BookingRow["cancellation_reason"]>;

// ── Incident Reports (ported from Staff's incidents/lib/status.ts) ──

export const INCIDENT_STATUS_ORDER: IncidentStatusValue[] = [
  "open",
  "in_pool",
  "in_progress",
  "resolved",
  "closed",
];

/**
 * "In Pool" rather than "Assigned": routing hands an incident to a
 * department, not to a person. "Awaiting Triage" rather than "Open": the
 * word Admin's page invented read as though a citizen's report just sat
 * there, when in fact this is the state before it's even been routed. Ported
 * verbatim from Staff so both portals describe the same enum value the same
 * way.
 */
export const INCIDENT_STATUS_LABELS: Record<IncidentStatusValue, string> = {
  open: "Awaiting Triage",
  in_pool: "In Pool",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

// Label text is identical to what Admin already showed — only the badge
// COLOR (src/portals/admin/lib/status-colors.ts) disagreed with Staff's, not this text.
export const INCIDENT_LEVEL_LABELS: Record<IncidentLevelValue, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * Ported directly from Staff's CLOSURE_REASON_LABELS
 * (src/portals/admin/features/incidents/lib/status.ts:61-67) — same reasoning as
 * INCIDENT_STATUS_LABELS above: a Mayor reading this portal and a frontline
 * clerk reading Staff's must read the same word for the same enum value.
 * All 5 closure_reason values are reachable on a `closed` incident row
 * (Admin Portal Fix Plan, Task 5.3) — `expired_unverified` and
 * `auto_confirmed` in particular are not merely theoretical, they're what
 * l57_incident_lifecycle_sweeper.sql's PASS 3 / auto-confirm paths write.
 */
export const CLOSURE_REASON_LABELS: Record<ClosureReasonValue, string> = {
  citizen_confirmed: "Confirmed",
  auto_confirmed: "Auto-confirmed",
  invalid: "Invalid",
  duplicate: "Duplicate",
  expired_unverified: "Expired (Unverified)",
};

// ── Yellow Card (ported from Staff's yellow-card/lib/status.ts) ──

export const YELLOW_CARD_STATUS_ORDER: YellowCardStatusValue[] = [
  "pending",
  "resubmitted",
  "revision_requested",
  "approved",
  "rejected",
  "withdrawn",
];

export const YELLOW_CARD_STATUS_LABELS: Record<YellowCardStatusValue, string> = {
  pending: "Pending Review",
  resubmitted: "Resubmitted",
  revision_requested: "Revision Requested",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

// ── Convention Center bookings (Admin-only — no Staff sibling) ──

export const BOOKING_STATUS_ORDER: BookingStatusValue[] = [
  "pending",
  "awaiting_tier_review",
  "awaiting_resubmission",
  "awaiting_quote",
  "awaiting_payment",
  "payment_verification",
  "confirmed",
  "fully_paid",
  "completed",
  "cancelled",
];

export const BOOKING_STATUS_LABELS: Record<BookingStatusValue, string> = {
  pending: "Pending",
  awaiting_tier_review: "Tier review",
  awaiting_resubmission: "Awaiting resubmission",
  awaiting_quote: "Awaiting quote",
  awaiting_payment: "Awaiting payment",
  payment_verification: "Payment verification",
  confirmed: "Confirmed",
  fully_paid: "Fully paid",
  completed: "Completed",
  cancelled: "Cancelled",
};

/**
 * Admin-invented — bookings are not Staff's domain, so there is no sibling
 * map to port (contrast CLOSURE_REASON_LABELS above, which is ported).
 * All 5 booking_cancellation_reason values are reachable on a `cancelled`
 * booking row (Admin Portal Fix Plan, Task 5.3; expired_unrevised since l77b,
 * a Revision Request nobody answered).
 */
export const BOOKING_CANCELLATION_REASON_LABELS: Record<BookingCancellationReasonValue, string> = {
  rejected_by_staff: "Rejected by staff",
  cancelled_by_citizen: "Cancelled by organiser",
  expired_unpaid: "Expired (unpaid)",
  expired_unrevised: "Expired (revision not submitted)",
  no_show: "No-show",
};

// ── Fallback lookups for raw, plain-`string`-typed codes ──
//
// IncidentPii/BookingPii (from readIncidentPii/readBookingPii, the two
// review modals' audited PII RPCs) type their `status`/`incident_level`
// columns as plain `string` on the generated Supabase types, not the
// narrower IncidentStatusValue/IncidentLevelValue/BookingStatusValue unions
// above — so a direct `INCIDENT_STATUS_LABELS[data.status]` lookup won't
// typecheck against a `Record<IncidentStatusValue, string>`. These three
// functions exist so the review modal a table row's Review button opens can
// still show the SAME friendly label the table itself already shows for
// that row (Admin Portal Fix Plan, final review) — the whole point of this
// file — without either a type error or an unsafe cast at each call site.
// Each degrades gracefully rather than throwing: a code the corresponding
// map doesn't recognise renders as itself instead of crashing the modal.
export function incidentStatusLabel(code: string): string {
  return (INCIDENT_STATUS_LABELS as Record<string, string>)[code] ?? code;
}

export function incidentLevelLabel(code: string): string {
  return (INCIDENT_LEVEL_LABELS as Record<string, string>)[code] ?? code;
}

export function bookingStatusLabel(code: string): string {
  return (BOOKING_STATUS_LABELS as Record<string, string>)[code] ?? code;
}
