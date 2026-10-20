import {
  isYellowCardApplicationStatus,
  type MyYellowCardApplication,
  type MyYellowCard,
  type YellowCardApplicationStatus,
} from '@/portals/citizen/features/yellow-card/types';
import type { MyIncident } from '@/portals/citizen/features/incidents/types';
import type { StatusMeta, YellowCardStatusDisplay } from '../types';

// Statuses that share a label deliberately share a color too — the dashboard
// tallies donut segments by grouping on `.label` and reuses any member's
// color, so there is no separate grouping table to keep in sync.
export const INCIDENT_STATUS_META: Record<string, StatusMeta> = {
  open:        { label: 'Open',        color: '#FCD34D', icon: '⏳' },
  in_pool:     { label: 'Open',        color: '#FCD34D', icon: '⏳' },
  in_progress: { label: 'In Progress', color: '#8B5CF6', icon: '🔧' },
  resolved:    { label: 'Resolved',    color: '#10B981', icon: '✓' },
  closed:      { label: 'Closed',      color: '#6B7280', icon: '✓' },
};

export const YELLOW_CARD_STATUS_META: Record<string, StatusMeta> = {
  pending:            { label: 'Pending Review',  color: '#FCD34D', icon: '⏳' },
  resubmitted:        { label: 'Pending Review',  color: '#FCD34D', icon: '⏳' },
  revision_requested: { label: 'Action Required', color: '#F97316', icon: '⚠️' },
  approved:           { label: 'Approved',         color: '#10B981', icon: '✓' },
  rejected:           { label: 'Rejected',         color: '#EF4444', icon: '✕' },
  withdrawn:          { label: 'Withdrawn',        color: '#6B7280', icon: '↩' },
};

export const BOOKING_STATUS_META: Record<string, StatusMeta> = {
  pending:              { label: 'Pending',          color: '#FCD34D', icon: '⏳' },
  // DB l77b (SCRUM-198): a discount claim under City Hall's review, and the
  // one Revision Request waiting on the citizen — "Action Required", as the
  // Yellow Card's revision_requested is.
  awaiting_tier_review: { label: 'Discount Under Review', color: '#FCD34D', icon: '🔍' },
  awaiting_resubmission: { label: 'Action Required',      color: '#F97316', icon: '⚠️' },
  awaiting_quote:       { label: 'Awaiting Quote',    color: '#FCD34D', icon: '⏳' },
  awaiting_payment:     { label: 'Awaiting Payment',  color: '#8B5CF6', icon: '💳' },
  payment_verification: { label: 'Verifying Payment', color: '#8B5CF6', icon: '🔍' },
  confirmed:            { label: 'Confirmed',         color: '#10B981', icon: '✓' },
  fully_paid:           { label: 'Fully Paid',        color: '#10B981', icon: '✓' },
  completed:            { label: 'Completed',         color: '#10B981', icon: '✓' },
  cancelled:            { label: 'Cancelled',         color: '#EF4444', icon: '✕' },
};

/**
 * Whether the review clock is still counting down for this status.
 *
 * An exhaustive switch rather than a membership test, so adding a member to
 * `YELLOW_CARD_APPLICATION_STATUSES` fails the typecheck here ("lacks ending
 * return statement") until it is given an answer. A `Set` would have silently
 * treated it as not-running.
 *
 * `revision_requested` is the one that is easy to get wrong: it is undecided, but
 * the clock is paused while the application sits with the citizen, and `due_at`
 * keeps its old target instead of being cleared.
 */
function slaClockIsRunning(status: YellowCardApplicationStatus): boolean {
  switch (status) {
    case 'pending':
    case 'resubmitted':
      return true;
    case 'revision_requested':
    case 'approved':
    case 'rejected':
    case 'withdrawn':
      return false;
  }
}

/**
 * The SLA target to display for a Yellow Card application, or null when a date
 * would be meaningless or absent.
 *
 * The database keeps `due_at` on decided rows (DB#11), so a caller cannot read a
 * non-null value as "still has a deadline" — that judgement lives here. A status
 * the frontend does not know is treated as not running, because claiming a
 * deadline on an unrecognised state is the worse failure.
 */
export function yellowCardSlaTarget(
  application: Pick<MyYellowCardApplication, 'status' | 'due_at'>,
): string | null {
  if (!isYellowCardApplicationStatus(application.status)) return null;
  return slaClockIsRunning(application.status) ? application.due_at : null;
}

/**
 * The incident statuses whose SLA clock is still counting down — somebody at
 * the LGU still has work to do. `resolved` is the one that is easy to get
 * wrong: the report is not closed, but the clock stopped at `resolved_at` and
 * what is left is the citizen's own confirmation, which has no deadline.
 */
const INCIDENT_SLA_RUNNING = new Set(['open', 'in_pool', 'in_progress']);

/**
 * The SLA deadline to display for an incident, or null when a date would be
 * meaningless or absent.
 *
 * The database keeps `sla_due_at` on resolved and closed rows, so a caller
 * cannot read a non-null value as "still has a deadline" — that judgement lives
 * here, as it does for `yellowCardSlaTarget`. A closed report showing "SLA Due"
 * read as though the city still owed the citizen something (SCRUM-193). A
 * status the frontend does not know is treated as not running.
 */
export function incidentSlaTarget(
  incident: Pick<MyIncident, 'status' | 'sla_due_at'>,
): string | null {
  return INCIDENT_SLA_RUNNING.has(incident.status) ? incident.sla_due_at : null;
}

/**
 * An issued card is a stronger signal than "latest application status", so it
 * takes priority — and that has to hold for ALL THREE `yellow_card_status`
 * values, not just `active`.
 *
 * Checking only `active` and falling through was a materially false display: a
 * citizen whose card had been revoked almost always still has an `approved`
 * application behind it (revocation does not undo the approval), so a revoked
 * health credential rendered as "Approved". `superseded` behaved the same way.
 *
 * Falls back to the latest application (callers pass results already sorted
 * newest-first by the service layer) or "Not Applied".
 */
export function computeYellowCardStatus(
  applications: MyYellowCardApplication[],
  cards: MyYellowCard[],
): YellowCardStatusDisplay {
  const activeCard = cards.find((c) => c.status === 'active');
  if (activeCard) {
    return {
      label: 'Card Active',
      color: '#10B981',
      icon: '🪪',
      ref: activeCard.card_number,
      dateLabel: 'Valid From',
      date: activeCard.valid_from,
    };
  }

  // No active card, but a card exists: report the card's real state rather than
  // letting the application status speak for it. Cards are newest-first.
  const revokedCard = cards.find((c) => c.status === 'revoked');
  if (revokedCard) {
    return {
      label: 'Card Revoked',
      color: '#DC2626',
      icon: '⛔',
      ref: revokedCard.card_number,
      dateLabel: 'Valid From',
      date: revokedCard.valid_from,
      reason: revokedCard.revoked_reason ?? undefined,
    };
  }

  // `superseded` means a newer card replaced this one. If a replacement were
  // active it would have matched above, so reaching here means the newer card
  // is not active either — say so plainly instead of showing "Approved".
  const supersededCard = cards.find((c) => c.status === 'superseded');
  if (supersededCard) {
    return {
      label: 'Card Superseded',
      color: '#6B7280',
      icon: '↻',
      ref: supersededCard.card_number,
      dateLabel: 'Valid From',
      date: supersededCard.valid_from,
    };
  }

  if (applications.length === 0) {
    return { label: 'Not Applied', color: '#6B7280', icon: '—', ref: null, dateLabel: '', date: null };
  }

  const latest = applications[0];
  const meta = YELLOW_CARD_STATUS_META[latest.status] ?? { label: latest.status, color: '#6B7280', icon: '•' };
  const reason =
    latest.status === 'revision_requested' || latest.status === 'rejected'
      ? latest.current_reason ?? undefined
      : undefined;

  return {
    label: meta.label,
    color: meta.color,
    icon: meta.icon,
    ref: latest.reference_number,
    dateLabel: 'Submitted',
    date: latest.submitted_at,
    reason,
  };
}
