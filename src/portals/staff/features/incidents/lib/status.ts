import type {
  ClosureReason,
  IncidentEventType,
  IncidentLevel,
  IncidentStatus,
} from "../types";

type BadgeVariant = "default" | "success" | "warning" | "destructive" | "info";

export const STATUS_ORDER: IncidentStatus[] = [
  "open",
  "in_pool",
  "in_progress",
  "resolved",
  "closed",
];

/**
 * "In Pool" rather than "Assigned": routing hands an incident to a department,
 * not to a person. Nobody owns it until a responder claims it, and calling that
 * "Assigned" is what made the mock's queue read as though work were underway.
 */
export const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: "Awaiting Triage",
  in_pool: "In Pool",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const STATUS_BADGE_VARIANT: Record<IncidentStatus, BadgeVariant> = {
  open: "info",
  in_pool: "warning",
  in_progress: "info",
  resolved: "success",
  closed: "default",
};

export const LEVEL_ORDER: IncidentLevel[] = ["critical", "high", "medium", "low"];

export const LEVEL_LABELS: Record<IncidentLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const LEVEL_BADGE_VARIANT: Record<IncidentLevel, BadgeVariant> = {
  critical: "destructive",
  high: "warning",
  medium: "info",
  low: "default",
};

/**
 * Why an incident closed. The mock knew only about expiry, and modelled it as a
 * sixth status; the database models it as a reason on a closed row, which is why
 * a closed incident that a citizen confirmed and one that was thrown out as a
 * duplicate looked identical before this.
 */
export const CLOSURE_REASON_LABELS: Record<ClosureReason, string> = {
  citizen_confirmed: "Confirmed",
  auto_confirmed: "Auto-confirmed",
  invalid: "Invalid",
  duplicate: "Duplicate",
  expired_unverified: "Expired (Unverified)",
};

/**
 * All nineteen. The mock had thirteen, and collapsed the three field stages into
 * one `stage_note` — which meant a responder's timeline could not distinguish
 * "on my way" from "standing at the site".
 */
export const EVENT_LABELS: Record<IncidentEventType, string> = {
  submitted: "Submitted",
  verified: "Verified",
  routed: "Routed",
  rerouted: "Rerouted",
  claimed: "Claimed",
  stage_en_route: "En route",
  stage_on_site: "On site",
  stage_working: "Working",
  note: "Field note",
  photo_added: "Photo added",
  released: "Released",
  force_released: "Force-released",
  rejected: "Rejected to staff",
  resolved: "Resolved",
  confirmed: "Confirmed",
  reopened: "Reopened",
  closed: "Closed",
  expired: "Expired",
  nudged: "Reminder sent",
};

/**
 * Deliberately narrower than `route_incident`, which permits routing until an
 * incident is resolved.
 *
 * Rerouting an `in_progress` incident changes `assigned_department_code` and
 * leaves `assigned_responder_id` alone, and `responder_incidents` filters on
 * `assigned_department_code = jwt_department()` — so the incident disappears
 * from the list of the responder standing at the site. `force_release_incident`
 * exists to detach a responder first and returns the incident to `in_pool`,
 * where rerouting is safe. See decision 7.
 */
export const ROUTABLE_STATUSES: IncidentStatus[] = ["open", "in_pool"];

export function isRoutable(status: IncidentStatus): boolean {
  return ROUTABLE_STATUSES.includes(status);
}

/**
 * The statuses `refuse_incident` accepts, matching the RPC exactly (l85).
 *
 * The same two members as ROUTABLE_STATUSES and deliberately not that
 * constant: routing is narrowed here for a UI reason the RPC does not share,
 * while refusal is narrowed by the RPC itself — a report a responder holds
 * must be released or force-released first, so nobody's work is pulled out
 * from under them on site. Either rule may move without the other.
 */
export const REFUSABLE_STATUSES: readonly IncidentStatus[] = ["open", "in_pool"];

export function isRefusable(status: IncidentStatus): boolean {
  return REFUSABLE_STATUSES.includes(status);
}

/**
 * Awaiting Triage: reports nobody has routed to a department yet.
 *
 * This is the module's **arrival** set — what the queue's activity badge means
 * by "3 new", and the set both its baseline and its background poll read, which
 * is what keeps those two figures from drifting apart.
 *
 * Not ROUTABLE_STATUSES, which looks like a match and is not. That constant is
 * scoped to *routing* and holds `in_pool` because an incident already handed to
 * a department can still be handed to another one; the comment above it is
 * about detaching a responder, a concern with nothing to do with arrival.
 * Hanging a second, unrelated rule on it would put two questions on one line
 * and drift them apart the first time either moved — which is the drift #12 was
 * spent collapsing.
 *
 * Verification is deliberately not part of this. A report the citizen has not
 * confirmed has no SLA clock and may never become real, and it is still an
 * arrival: deciding which reports are real *is* what triage is, so filtering
 * them out here would make that decision invisibly, on the officer's behalf.
 *
 * `readonly` for the reason the other two sets are: it has two readers — the
 * badge's baseline fold below and the poll in ./queries.ts — and a set anyone
 * can push onto is a set that can be wrong for one of them.
 *
 * Written out rather than derived from a `Record<IncidentStatus, boolean>` the
 * way the other two sets are. That map is there to force a per-status
 * judgement nobody can skip — Booking's `awaiting_payment` is the one it would
 * be easy to get wrong. Membership here is not that kind of call: `open` is
 * the status that means "not routed yet", and a five-entry map with one `true`
 * would add the form without the answer.
 *
 * The one genuine judgement this set makes could not go in that map anyway.
 * It is the paragraph above — unverified reports count — and verification is
 * not a status, so no `Record<IncidentStatus, …>` can hold the answer. The map
 * would look like the place membership is decided while the decision that
 * matters sat above it in prose.
 *
 * The day a second status joins, the map is worth writing.
 */
export const AWAITING_TRIAGE_STATUSES: readonly IncidentStatus[] = ["open"];

/**
 * How much of the queue is awaiting triage, out of the per-status tallies the
 * queue page already has.
 *
 * Folds the set rather than reading `counts.open` directly, even though the set
 * has a single member and the fold therefore looks like a wrapper around one
 * lookup. A hand-written status lookup is invisible to a search for the
 * constant, and would go on quietly excluding any status later added to the set
 * while still type-checking.
 */
export function awaitingTriageCount(
  counts: Record<IncidentStatus, number>,
): number {
  return AWAITING_TRIAGE_STATUSES.reduce((sum, status) => sum + counts[status], 0);
}

/**
 * Whether an incident in this status still has somebody working on it.
 *
 * Every status answers, rather than the yeses being listed and the rest left
 * to inference. `resolved` is the one it is easiest to get wrong: the incident
 * is not finished — a citizen still has to confirm it, or the auto-confirm
 * window has to run out — but nobody in this building has anything left to do
 * with it, so it is not the office's work any more.
 */
const HAS_WORK_OUTSTANDING: Record<IncidentStatus, boolean> = {
  /** Nobody has routed it to a department. */
  open: true,
  /** Routed, but no responder has claimed it. */
  in_pool: true,
  /** A responder is on it. */
  in_progress: true,
  resolved: false,
  closed: false,
};

/**
 * Active: the incidents this office is still working on — everything that has
 * not finished, whether it is sitting on a triage desk, waiting in a
 * department's pool, or out with a responder.
 *
 * Two readers, which is why it is one constant: the At Risk figure on the
 * queue page filters its read to this set, and the dashboard card's four
 * queries each narrow to it. It was written twice across those two modules
 * before #34 — an unnamed inline literal in the at-risk read, and a mutable
 * module-private constant in the card that four queries read — so a sixth
 * status would have landed in one copy and not the other.
 *
 * **"Can be at risk" is the same rule, not a second one that happens to
 * agree.** The at-risk read narrows to this set because only these can be at
 * risk, which is a different sentence from *somebody still has work to do* —
 * and this module already carries one scar from two sentences sharing a line
 * (see ROUTABLE_STATUSES above, which is deliberately not the arrival set).
 * The difference here is that both sentences are the same question asked
 * twice. `deriveSlaState` leaves the at-risk branch for `resolved` and
 * `closed` and for nothing else, so the statuses that can be at risk are
 * exactly the statuses that are not finished — the same predicate this map
 * writes down, reached from the other side.
 *
 * What would split them is a status-keyed reason a *live* incident cannot be
 * at risk — a clock paused on a status rather than on `is_verified`. That
 * would live in `deriveSlaState`'s branches, not here, and ./status.test.ts
 * asserts the agreement over every status so the day it stops holding is the
 * day a test fails rather than the day the At Risk card quietly under-reports.
 *
 * Derived and `readonly` for the reason NEEDS_ACTION_STATUSES is in Booking:
 * with two readers, a set anyone can push onto is a set that can be wrong for
 * one of them. Filtering STATUS_ORDER also keeps the bytes of the `in.()`
 * filter both readers send stable.
 *
 * The map above is written out where AWAITING_TRIAGE_STATUSES declines one, on
 * that constant's own terms: it said the map is worth writing the day a second
 * status joins the set, and this set has three.
 *
 * *At Risk* went into CONTEXT.md at #39. *Active* was considered there and
 * **declined**, so the prose above is its only home and is meant to stay that
 * way. It is an engineering set noun: no screen prints it and nobody in this
 * building says it — the four summary cards read *Awaiting Triage*,
 * *In Pool · Unclaimed*, *At Risk* and *In Progress*, and this set is the
 * invisible denominator behind the third of them and the dashboard card's
 * counts. docs/carried-forward.md item 6, now closed, carries the argument and
 * why noticing the term is missing is not grounds to reopen it.
 */
export const ACTIVE_STATUSES: readonly IncidentStatus[] = STATUS_ORDER.filter(
  (status) => HAS_WORK_OUTSTANDING[status],
);
