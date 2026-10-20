import { describe, it, expect } from 'vitest';
import {
  computeYellowCardStatus,
  yellowCardSlaTarget,
  incidentSlaTarget,
  INCIDENT_STATUS_META,
  YELLOW_CARD_STATUS_META,
  BOOKING_STATUS_META,
} from '@/portals/citizen/features/dashboard/lib/status';
import {
  YELLOW_CARD_APPLICATION_STATUSES,
  type MyYellowCardApplication,
  type MyYellowCard,
  type YellowCardApplicationStatus,
} from '@/portals/citizen/features/yellow-card/types';

const application = (overrides: Partial<MyYellowCardApplication> = {}): MyYellowCardApplication => ({
  id: 'app-1',
  reference_number: 'YC-2026-000001',
  status: 'pending',
  needs_dedup_review: false,
  first_name: 'Juan',
  middle_name: null,
  last_name: 'Dela Cruz',
  suffix: null,
  date_of_birth: '1985-03-20',
  gender_code: 'male',
  civil_status_code: 'single',
  barangay_code: 'bocohan',
  barangay_name: 'Bocohan',
  complete_address: '123 Rizal Street',
  contact_number: '09171234567',
  email_address: 'juan@example.com',
  years_of_residency: 5,
  voter_id_number: '123-456-789',
  privacy_consent: true,
  submitted_at: '2026-07-01T00:00:00Z',
  sla_target_hours: 72,
  due_at: '2026-07-03T00:00:00Z',
  decided_at: null,
  current_decision: null,
  current_reason: null,
  current_reviewed_at: null,
  document_count: 1,
  ...overrides,
});

const card = (overrides: Partial<MyYellowCard> = {}): MyYellowCard => ({
  id: 'card-1',
  card_number: 'LC-2026-000001',
  verification_token: 'tok-1',
  status: 'active',
  application_id: 'app-1',
  holder_name: 'Juan Dela Cruz',
  barangay_name: 'Bocohan',
  valid_from: '2026-07-05',
  expires_at: null,
  revoked_reason: null,
  ...overrides,
});

/**
 * CLAUDE.md: "The dashboard tallies donut segments by grouping on `.label`, so
 * statuses that share a label must share a color — there's no separate grouping
 * table." Documented but unenforced until now: two statuses sharing a label with
 * different colors give the merged segment whichever color is reached first,
 * which is iteration order, not a decision.
 */
describe('BOOKING_STATUS_META', () => {
  it('names every booking status, including the two Tier Review ones', () => {
    for (const status of [
      'pending',
      'awaiting_tier_review',
      'awaiting_resubmission',
      'awaiting_quote',
      'awaiting_payment',
      'payment_verification',
      'confirmed',
      'fully_paid',
      'completed',
      'cancelled',
    ]) {
      expect(BOOKING_STATUS_META[status], status).toBeDefined();
    }
  });
});

describe('status meta tables', () => {
  const TABLES = Object.entries({
    incident: INCIDENT_STATUS_META,
    'yellow card': YELLOW_CARD_STATUS_META,
    booking: BOOKING_STATUS_META,
  });

  it.each(TABLES)('gives each shared %s label a single color', (_name, table) => {
    const colorsByLabel = new Map<string, Set<string>>();
    for (const meta of Object.values(table)) {
      const colors = colorsByLabel.get(meta.label) ?? new Set<string>();
      colors.add(meta.color);
      colorsByLabel.set(meta.label, colors);
    }
    for (const [label, colors] of colorsByLabel) {
      expect([...colors], `"${label}" is drawn in more than one color`).toHaveLength(1);
    }
  });
});

/**
 * The citizen dashboard deliberately shows one label for `pending` and
 * `resubmitted` — a citizen waiting for a decision does not need the
 * distinction, and the donut wants one segment.
 *
 * It is also why the resubmit success screen names no status at all (issue #9).
 * Staff shows `resubmitted` as "Resubmitted", so prose that named either label
 * would contradict one surface or the other. If these labels are ever split,
 * revisit `app/yellow-card/[id]/revise/page.tsx`, which can then safely name one.
 */
describe('pending and resubmitted', () => {
  it('are drawn identically, label and color', () => {
    expect(YELLOW_CARD_STATUS_META.resubmitted).toEqual(YELLOW_CARD_STATUS_META.pending);
  });
});

/**
 * The dashboard printed "SLA Target" on every Yellow Card application whatever
 * its status. YC-2026-000091 showed "Approved - SLA Target April 10, 2026" on an
 * application submitted 6 August 2026 and decided 30 September (issue #11).
 *
 * The date is not wrong because the screen computed it: `due_at` is populated on
 * every decided row (verified on the Sandbox 2026-10-02: approved 8/8, rejected
 * 10/10, withdrawn 9/9 all carry one), and that April date is a demo-data
 * artefact of the l70a cut-over, tracked in DB#11. What this screen controls is
 * whether a target means anything to the citizen reading it, and after a decision
 * it does not.
 */
describe('yellowCardSlaTarget', () => {
  const RUNNING_TARGET = '2026-08-21T07:00:00Z';

  it('passes the target through verbatim while the clock runs', () => {
    expect(yellowCardSlaTarget({ status: 'pending', due_at: RUNNING_TARGET })).toBe(RUNNING_TARGET);
  });

  // `due_at` is nullable. A row without one must not render an em dash under an
  // "SLA Target" heading — the heading is the misleading part.
  it('shows nothing when a running application carries no target', () => {
    expect(yellowCardSlaTarget({ status: 'pending', due_at: null })).toBeNull();
  });

  // The statuses are hand-maintained against the database, so an unrecognised one
  // is possible. Claiming a deadline for it would be the worse failure.
  it('shows nothing for a status the frontend does not know', () => {
    expect(yellowCardSlaTarget({ status: 'escalated', due_at: RUNNING_TARGET })).toBeNull();
  });

  /**
   * Every status gets a deliberate answer, recorded here rather than inferred.
   *
   * The coverage check reads `YELLOW_CARD_APPLICATION_STATUSES`, so adding a
   * status to that list without deciding its SLA copy fails here — and fails the
   * typecheck too, since `slaClockIsRunning` switches exhaustively over it. What
   * neither can catch is the database gaining a status that nobody adds to the
   * list; that is why the list carries the date it was verified.
   */
  describe('status coverage', () => {
    const EXPECTED: Record<YellowCardApplicationStatus, boolean> = {
      pending: true,
      resubmitted: true,
      revision_requested: false,
      approved: false,
      rejected: false,
      withdrawn: false,
    };

    it('decides about every status the slice knows', () => {
      expect(Object.keys(EXPECTED).sort()).toEqual([...YELLOW_CARD_APPLICATION_STATUSES].sort());
    });

    it.each(YELLOW_CARD_APPLICATION_STATUSES)('%s', (status) => {
      const shown = yellowCardSlaTarget({ status, due_at: RUNNING_TARGET }) !== null;
      expect(shown).toBe(EXPECTED[status]);
    });
  });
});

describe('incidentSlaTarget', () => {
  const DUE = '2026-08-21T07:00:00Z';

  it('passes the deadline through verbatim while somebody is still working on it', () => {
    expect(incidentSlaTarget({ status: 'in_pool', sla_due_at: DUE })).toBe(DUE);
  });

  // The clock arms only once a report is both verified and routed, so a fresh
  // report has no deadline yet. An em dash under "SLA Due" says nothing.
  it('shows nothing when the clock has not armed', () => {
    expect(incidentSlaTarget({ status: 'open', sla_due_at: null })).toBeNull();
  });

  it('shows nothing for a status the frontend does not know', () => {
    expect(incidentSlaTarget({ status: 'escalated', sla_due_at: DUE })).toBeNull();
  });

  /**
   * The database keeps `sla_due_at` on finished rows, which is how a closed
   * report came to show "SLA Due" in blue as though the city still owed the
   * citizen something (SCRUM-193). `resolved` gets the same answer: the work
   * is done and the clock stopped at `resolved_at` — what is left is the
   * citizen's confirmation, which has no SLA.
   */
  it.each([
    ['open', true],
    ['in_pool', true],
    ['in_progress', true],
    ['resolved', false],
    ['closed', false],
  ])('%s', (status, shown) => {
    expect(incidentSlaTarget({ status, sla_due_at: DUE }) !== null).toBe(shown);
  });
});

describe('computeYellowCardStatus', () => {
  it('returns "Not Applied" when there are no applications and no cards', () => {
    const result = computeYellowCardStatus([], []);
    expect(result.label).toBe('Not Applied');
    expect(result.ref).toBeNull();
  });

  it('prefers an active card over any application status', () => {
    const result = computeYellowCardStatus(
      [application({ status: 'approved' })],
      [card({ status: 'active' })],
    );
    expect(result.label).toBe('Card Active');
    expect(result.ref).toBe('LC-2026-000001');
    expect(result.dateLabel).toBe('Valid From');
    expect(result.date).toBe('2026-07-05');
  });

  // A revoked card must speak for itself. Falling back to the application was
  // the old behaviour and it was wrong: revocation does not undo the approval
  // behind the card, so a revoked health credential displayed as "Approved".
  it('reports a revoked card as revoked, never as the application status', () => {
    const result = computeYellowCardStatus(
      [application({ status: 'approved' })],
      [card({ status: 'revoked', revoked_reason: 'Card reported lost.' })],
    );
    expect(result.label).toBe('Card Revoked');
    expect(result.label).not.toBe('Approved');
    expect(result.ref).toBe('LC-2026-000001');
    expect(result.reason).toBe('Card reported lost.');
  });

  it('reports a superseded card as superseded, never as the application status', () => {
    const result = computeYellowCardStatus(
      [application({ status: 'approved' })],
      [card({ status: 'superseded' })],
    );
    expect(result.label).toBe('Card Superseded');
    expect(result.label).not.toBe('Approved');
  });

  // An active card still outranks any other card the citizen holds.
  it('prefers an active card over a revoked one', () => {
    const result = computeYellowCardStatus(
      [application({ status: 'approved' })],
      [card({ status: 'revoked' }), card({ id: 'card-2', status: 'active' })],
    );
    expect(result.label).toBe('Card Active');
  });

  it('falls back to the latest application when the citizen holds no card at all', () => {
    const result = computeYellowCardStatus([application({ status: 'pending' })], []);
    expect(result.label).toBe('Pending Review');
  });

  it('falls back to the latest application (already sorted, first element) when there is no card', () => {
    const result = computeYellowCardStatus(
      [application({ status: 'revision_requested', reference_number: 'YC-2026-000002', current_reason: 'Please resubmit a clearer voter ID photo.' })],
      [],
    );
    expect(result.label).toBe('Action Required');
    expect(result.ref).toBe('YC-2026-000002');
    expect(result.reason).toBe('Please resubmit a clearer voter ID photo.');
  });

  it('surfaces the rejection reason for a rejected application', () => {
    const result = computeYellowCardStatus(
      [application({ status: 'rejected', current_reason: 'Voter ID could not be verified.' })],
      [],
    );
    expect(result.label).toBe('Rejected');
    expect(result.reason).toBe('Voter ID could not be verified.');
  });

  it('does not surface a reason for a plain pending application', () => {
    const result = computeYellowCardStatus([application({ status: 'pending' })], []);
    expect(result.reason).toBeUndefined();
  });

  it('reads applications[0] (the caller\'s pre-sorted newest-first order), not the last element', () => {
    const result = computeYellowCardStatus(
      [
        application({ status: 'approved', reference_number: 'YC-2026-000003' }),
        application({ status: 'rejected', reference_number: 'YC-2026-000002' }),
        application({ status: 'pending', reference_number: 'YC-2026-000001' }),
      ],
      [],
    );
    expect(result.label).toBe('Approved');
    expect(result.ref).toBe('YC-2026-000003');
  });

  it('falls back gracefully for a status not present in YELLOW_CARD_STATUS_META (e.g. a future DB enum value)', () => {
    const result = computeYellowCardStatus(
      [application({ status: 'some_future_status' })],
      [],
    );
    expect(result.label).toBe('some_future_status');
    expect(result.color).toBe('#6B7280');
    expect(result.icon).toBe('•');
  });
});
