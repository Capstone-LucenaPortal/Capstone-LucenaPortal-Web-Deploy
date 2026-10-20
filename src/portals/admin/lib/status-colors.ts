import type { BadgeVariant } from "@/portals/admin/components/ui/badge";
import type {
  BookingStatusValue,
  IncidentLevelValue,
  IncidentStatusValue,
  YellowCardStatusValue,
} from "@/portals/admin/lib/status-labels";

// Badge variant, keyed on the enum CODE, not the display label.
//
// This used to be a single label-keyed getStatusBadgeClasses(status: string)
// — meaning a label rename in one of the STATUS_LABELS maps silently dropped
// that badge to the neutral gray fallback, with nothing failing to say so.
// Below is one function per domain instead of one flat Record<string, Tone>,
// which sidesteps a real collision risk: some enum codes repeat across
// domains with the same spelling but a different intended color (e.g.
// "pending" exists on both YellowCardStatusValue and BookingStatusValue).
//
// Each function returns a `BadgeVariant` (Badge's own five-value vocabulary
// — "default" | "success" | "warning" | "destructive" | "info" — see
// src/portals/admin/components/ui/badge.tsx), not a literal Tailwind className: Badge computes
// its own classes from the variant now, matching the sibling Staff portal's
// Badge API.
//
// The color CLASSIFICATIONS below are the same ones Admin already used
// (which statuses/levels read green/blue/yellow/red/gray, now expressed as
// success/info/warning/destructive/default), re-keyed by code — except where
// Admin's classification actively disagreed with Staff's canonical
// STATUS_BADGE_VARIANT / LEVEL_BADGE_VARIANT
// (src/portals/admin/features/{incidents,yellow-card}/lib/status.ts). Aligning with Staff
// is this task's whole point, so those cases were changed to match Staff,
// not merely re-keyed:
//   - incident_level.high: red -> yellow (Staff: "warning") — the case the
//     plan calls out by name.
//   - incident_level.medium: yellow -> blue (Staff: "info").
//   - incident_level.low: green -> gray (Staff: "default").
//   - incident_status.open: yellow -> blue (Staff: "info").
//   - yellow_card_status.pending: yellow -> gray (Staff: "default").
//   - yellow_card_status.resubmitted: yellow -> blue (Staff: "info").
// Booking status has no Staff sibling to reconcile against, so its
// classification is unchanged, just re-keyed from label to code.

// Partial, not Record<IncidentStatusValue, BadgeVariant>: "closed" has no
// entry on purpose (see comment below), so this must admit a missing key
// rather than require every code to be listed.
const INCIDENT_STATUS_VARIANTS: Partial<Record<IncidentStatusValue, BadgeVariant>> = {
  open: "info",
  in_pool: "warning",
  in_progress: "info",
  resolved: "success",
  // No closed entry, same as before this rework: closure_reason may or may
  // not mean the underlying problem was actually resolved, so it falls
  // through to the neutral default variant rather than reading as
  // unconditionally positive.
};

const INCIDENT_LEVEL_VARIANTS: Record<IncidentLevelValue, BadgeVariant> = {
  critical: "destructive",
  high: "warning",
  medium: "info",
  low: "default",
};

// Partial, not Record<YellowCardStatusValue, BadgeVariant>: "withdrawn" has
// no entry on purpose (see comment below).
const YELLOW_CARD_STATUS_VARIANTS: Partial<Record<YellowCardStatusValue, BadgeVariant>> = {
  pending: "default",
  resubmitted: "info",
  revision_requested: "warning",
  approved: "success",
  rejected: "destructive",
  // No withdrawn entry, same as before: it's the citizen's own doing, not a
  // refusal, so it falls through to the default variant rather than reading
  // as negative.
};

const BOOKING_STATUS_VARIANTS: Record<BookingStatusValue, BadgeVariant> = {
  pending: "warning",
  awaiting_tier_review: "warning",
  awaiting_resubmission: "warning",
  awaiting_quote: "warning",
  awaiting_payment: "warning",
  payment_verification: "info",
  confirmed: "info",
  fully_paid: "success",
  completed: "success",
  cancelled: "destructive",
};

export function getIncidentStatusVariant(code: IncidentStatusValue): BadgeVariant {
  return INCIDENT_STATUS_VARIANTS[code] ?? "default";
}

export function getIncidentLevelVariant(code: IncidentLevelValue): BadgeVariant {
  return INCIDENT_LEVEL_VARIANTS[code] ?? "default";
}

export function getYellowCardStatusVariant(code: YellowCardStatusValue): BadgeVariant {
  return YELLOW_CARD_STATUS_VARIANTS[code] ?? "default";
}

export function getBookingStatusVariant(code: BookingStatusValue): BadgeVariant {
  return BOOKING_STATUS_VARIANTS[code] ?? "default";
}

/**
 * The Yellow Card table's SLA column is not an enum status — it's a derived
 * on-time/breached/unknown tri-state (see applicationMet in src/portals/admin/features/sla/lib/sla.ts)
 * — so it gets its own small variant function rather than being folded into
 * getYellowCardStatusVariant. Out of this task's scope to redesign; this
 * preserves exactly the color behavior the old label-keyed
 * getStatusBadgeClasses gave "On time"/"Breached"/"Unknown".
 */
export function getSlaVariant(met: boolean | null): BadgeVariant {
  if (met === true) return "success";
  if (met === false) return "destructive";
  return "default";
}

// Bar colours for the Category mix / Event type mix panels.
//
// Keyed on the catalog CODE, not the human label. Both maps used to live in
// their page files keyed by label ("Infrastructure", "Wedding") — the value
// public_incident_categories / public_booking_event_types return and that
// Super Staff can edit. The analytics views carry only the code
// (admin_incident_analytics.category_code,
// admin_booking_analytics.event_type_code); the label is joined on for
// display. Keying the colour on the label therefore coupled presentation to
// mutable data: renaming "Public Safety" to "Peace and Order" in the catalog
// would silently drop that series to the neutral fallback, with nothing
// failing to say so. The code is the stable identity, so it is what these
// key on.
//
// A code with no entry falls back to neutral gray rather than throwing — a
// newly added catalog row should render, just without a bespoke colour.
//
// CATEGORY_BAR_CLASSES covers all four codes the incident_categories catalog
// currently seeds (infrastructure, public_safety, sanitation, environmental
// — see supabase/migrations/20260728233438_l09_seed_catalogs.sql in the DB
// repo). "health_services" is NOT one of them — that code belongs to the
// unrelated platform_post_categories catalog (announcements), which this
// page does not read. Verified against the DB repo's migrations before
// concluding there is no actual gap here.
const CATEGORY_BAR_CLASSES: Record<string, string> = {
  infrastructure: "bg-blue-900",
  public_safety: "bg-blue-700",
  sanitation: "bg-blue-500",
  environmental: "bg-blue-300",
};

const EVENT_TYPE_BAR_CLASSES: Record<string, string> = {
  conference: "bg-blue-950",
  wedding: "bg-blue-800",
  concert: "bg-blue-600",
  sports: "bg-blue-400",
  religious: "bg-blue-300",
  other: "bg-blue-200",
};

const NEUTRAL_BAR_CLASS = "bg-gray-500";

export function getCategoryBarClass(categoryCode: string): string {
  return CATEGORY_BAR_CLASSES[categoryCode] ?? NEUTRAL_BAR_CLASS;
}

export function getEventTypeBarClass(eventTypeCode: string): string {
  return EVENT_TYPE_BAR_CLASSES[eventTypeCode] ?? NEUTRAL_BAR_CLASS;
}

export function getCategoryChipClasses(_category: string): string {
  return "bg-gray-100 text-gray-700";
}

export function getEventTypeChipClasses(_eventType: string): string {
  return "bg-gray-100 text-gray-700";
}
