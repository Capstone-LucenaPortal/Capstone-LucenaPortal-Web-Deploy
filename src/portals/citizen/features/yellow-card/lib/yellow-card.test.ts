import { describe, it, expect, afterEach, vi } from 'vitest';
import type { MyYellowCardApplication, YellowCardApplicationFields } from '@/portals/citizen/features/yellow-card/types';
import { yellowCardService, YellowCardSubmitError, mapApplicationToFormValues, mapResubmitToParams, computeAgeError, liveApplicationNotice, liveNoticeCopy, LIVE_APPLICATION_STATUSES, type LiveApplicationStatus, type LiveApplicationNotice, translateResubmitError, translateUploadError, translateSubmitError, verifyCard, translateWithdrawError } from '@/portals/citizen/features/yellow-card/lib/yellow-card';
import * as supabaseClientModule from '@/portals/citizen/lib/supabase/client';

// The vitest environment for this project is 'node', which has no `localStorage` global.
// requestService.addRequest() (invoked by submitApplication's mock-mode branch) calls
// localStorage.setItem directly, so a minimal in-memory polyfill is installed here to let
// that code path run under test without modifying requestService.ts.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

/**
 * `/yellow-card` blocks a second application while one is live, and `approved`
 * counts as live because an approved application must still block a new one.
 * The notice it showed covered only `revision_requested` and "everything else",
 * so a cardholder was told their approved application was "currently being
 * processed" (issue #8, seen on YC-2026-000091 / LC-2026-000004).
 *
 * Statuses verified against the Sandbox 2026-10-01:
 * `yellow_card_application_status` is (pending, resubmitted, revision_requested,
 * approved, rejected, withdrawn) and `yellow_card_status` is
 * (active, revoked, superseded).
 */
describe('liveApplicationNotice', () => {
  const app = (status: string, id = 'app-1') => ({
    id,
    reference_number: 'YC-2026-000091',
    status,
  });
  const card = (
    status: string,
    overrides: Partial<{ card_number: string; application_id: string }> = {},
  ) => ({ card_number: 'LC-2026-000004', application_id: 'app-1', status, ...overrides });

  it('reports nothing when no application blocks a new one', () => {
    expect(liveApplicationNotice([], [])).toBeNull();
  });

  // `rejected` and `withdrawn` are real statuses that must NOT block: a citizen
  // whose application was rejected has to be able to apply again.
  it.each(['rejected', 'withdrawn'])('does not treat %s as live', (status) => {
    expect(liveApplicationNotice([app(status)], [])).toBeNull();
  });

  it('sends a revision request to the revise flow', () => {
    expect(liveApplicationNotice([app('revision_requested')], [])).toEqual({
      kind: 'revision',
      applicationId: 'app-1',
      reference: 'YC-2026-000091',
    });
  });

  it('reports an approved application with the active card it produced', () => {
    expect(liveApplicationNotice([app('approved')], [card('active')])).toEqual({
      kind: 'approved',
      reference: 'YC-2026-000091',
      card: { number: 'LC-2026-000004', status: 'active' },
    });
  });

  // Mock mode returns no cards at all, and approval-to-issuance is not
  // instantaneous. Printing "Card #undefined" would trade one wrong sentence for
  // another, so there is no card to name.
  it('reports approval with no card when none has been issued', () => {
    expect(liveApplicationNotice([app('approved')], [])).toEqual({
      kind: 'approved',
      reference: 'YC-2026-000091',
      card: null,
    });
  });

  // A revoked card is not one the citizen holds, but it was issued — the copy
  // has to tell that apart from "not issued yet", so the status travels with it.
  it.each(['revoked', 'superseded'])('keeps a %s card, with its status', (status) => {
    expect(liveApplicationNotice([app('approved')], [card(status)])).toMatchObject({
      card: { number: 'LC-2026-000004', status },
    });
  });

  it('prefers the active card when an older one was superseded', () => {
    const notice = liveApplicationNotice(
      [app('approved')],
      [card('superseded', { card_number: 'LC-2025-000001' }), card('active')],
    );
    expect(notice).toMatchObject({ card: { number: 'LC-2026-000004', status: 'active' } });
  });

  // `my_yellow_cards` returns every card the citizen holds, not just this
  // application's. Matching on `application_id` is what keeps an unrelated card
  // out of this notice.
  it('ignores a card belonging to a different application', () => {
    const other = [card('active', { application_id: 'app-2', card_number: 'LC-2026-000099' })];
    expect(liveApplicationNotice([app('approved')], other)).toMatchObject({ card: null });
  });

  it.each(['pending', 'resubmitted'])('still says %s is being processed', (status) => {
    expect(liveApplicationNotice([app(status)], [])).toEqual({
      kind: 'processing',
      reference: 'YC-2026-000091',
    });
  });
});

/**
 * The guard against issue #8 recurring. The blocking list used to live in the
 * page, apart from the copy, so a status could join the list and silently
 * inherit "currently being processed". Every blocking status must have a
 * deliberate notice, and this table is where that decision is recorded — add a
 * status to `LIVE_APPLICATION_STATUSES` and the first test here fails until its
 * copy is chosen.
 */
describe('every blocking status has a deliberate notice', () => {
  const EXPECTED: Record<LiveApplicationStatus, LiveApplicationNotice['kind']> = {
    pending: 'processing',
    resubmitted: 'processing',
    revision_requested: 'revision',
    approved: 'approved',
  };

  it('covers exactly the statuses that block a new application', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...LIVE_APPLICATION_STATUSES].sort());
  });

  it.each(LIVE_APPLICATION_STATUSES)('maps %s to its own notice', (status) => {
    const notice = liveApplicationNotice(
      [{ id: 'app-1', reference_number: 'YC-2026-000091', status }],
      [],
    );
    expect(notice?.kind).toBe(EXPECTED[status]);
  });
});

describe('liveNoticeCopy', () => {
  it('names the card a cardholder actually holds', () => {
    const { heading, detail } = liveNoticeCopy({
      kind: 'approved',
      reference: 'YC-2026-000091',
      card: { number: 'LC-2026-000004', status: 'active' },
    });
    expect(heading).toBe('You already have a Yellow Card');
    expect(detail).toContain('LC-2026-000004');
  });

  // The bug this issue was filed for: an approved application described as still
  // under review, in any of the three card situations.
  it('never calls an approved application "being processed"', () => {
    const cards = [
      null,
      { number: 'LC-2026-000004', status: 'active' },
      { number: 'LC-2026-000004', status: 'revoked' },
    ];
    for (const card of cards) {
      const { heading, detail } = liveNoticeCopy({
        kind: 'approved',
        reference: 'YC-2026-000091',
        card,
      });
      expect(`${heading} ${detail}`).not.toContain('being processed');
    }
  });

  // An issued-then-revoked card must not be described as awaiting issuance.
  it('does not promise issuance for a card that was revoked', () => {
    const { heading, detail } = liveNoticeCopy({
      kind: 'approved',
      reference: 'YC-2026-000091',
      card: { number: 'LC-2026-000004', status: 'revoked' },
    });
    expect(heading).toBe('Your Yellow Card is no longer active');
    expect(detail).toContain('LC-2026-000004');
    expect(detail).not.toMatch(/once the card is issued/i);
  });

  it('omits the number entirely when no card exists', () => {
    const { detail } = liveNoticeCopy({ kind: 'approved', reference: 'YC-2026-000091', card: null });
    expect(detail).not.toContain('Card #');
    expect(detail).toContain('YC-2026-000091');
  });

  it('keeps the unchanged sentence for an application still with a reviewer', () => {
    expect(liveNoticeCopy({ kind: 'processing', reference: 'YC-2026-000091' })).toEqual({
      icon: 'ℹ️',
      heading: 'You already have an active application',
      detail: 'Application #YC-2026-000091 is currently being processed.',
    });
  });

  it('keeps the unchanged sentence for a revision request', () => {
    const { heading, detail } = liveNoticeCopy({
      kind: 'revision',
      applicationId: 'app-1',
      reference: 'YC-2026-000091',
    });
    expect(heading).toBe('Your application needs changes');
    expect(detail).toContain('was sent back for revision');
  });
});

describe('yellowCardService in mock mode (no backend)', () => {
  it('getMyApplications resolves [] when no backend is configured', async () => {
    expect(await yellowCardService.getMyApplications()).toEqual([]);
  });

  it('getMyCards resolves [] when no backend is configured', async () => {
    expect(await yellowCardService.getMyCards()).toEqual([]);
  });
});

describe('yellowCardService.submitApplication in mock mode (no backend)', () => {
  it('resolves a fake reference number and does not throw', async () => {
    const result = await yellowCardService.submitApplication({
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      dateOfBirth: '1990-01-15',
      genderCode: 'male',
      civilStatusCode: 'single',
      barangayCode: 'bocohan',
      completeAddress: '123 Rizal Street',
      contactNumber: '09171234567',
      emailAddress: 'juan@example.com',
      yearsOfResidency: 5,
      voterIdNumber: '123-456-789',
      privacyConsent: true,
    });
    expect(result).not.toBeInstanceOf(YellowCardSubmitError);
    expect(result.reference_number).toMatch(/^YC-\d{4}-\d{6}$/);
    expect(result.id).toBeTruthy();
  });
});

describe('yellowCardService.uploadVoterIdDocument in mock mode (no backend)', () => {
  it('resolves without throwing', async () => {
    const file = new File(['test'], 'voter-id.jpg', { type: 'image/jpeg' });
    await expect(yellowCardService.uploadVoterIdDocument('mock-app-id', file)).resolves.toBeUndefined();
  });
});

/** A complete view row, used to prove every column is carried across. */
const VIEW_ROW: MyYellowCardApplication = {
  id: '11111111-2222-3333-4444-555555555555',
  reference_number: 'YC-2026-000091',
  status: 'revision_requested',
  needs_dedup_review: false,
  first_name: 'Kin',
  middle_name: null,
  last_name: 'Tester',
  suffix: null,
  date_of_birth: '1990-01-15',
  gender_code: 'male',
  civil_status_code: 'single',
  barangay_code: 'bocohan',
  barangay_name: 'Bocohan',
  complete_address: '123 Rizal Street',
  contact_number: '09171234567',
  email_address: 'kin@example.com',
  years_of_residency: 5,
  voter_id_number: '123-456-789',
  privacy_consent: true,
  submitted_at: '2026-08-07T01:00:00Z',
  sla_target_hours: 72,
  due_at: null,
  decided_at: null,
  current_decision: 'revision_requested',
  current_reason: 'Test Request Revision',
  current_reviewed_at: '2026-08-07T02:00:00Z',
  document_count: 1,
};

describe('mapApplicationToFormValues', () => {
  it('maps every editable column onto form strings', () => {
    expect(mapApplicationToFormValues(VIEW_ROW)).toEqual({
      voterIdNumber: '123-456-789',
      firstName: 'Kin',
      middleName: '',
      lastName: 'Tester',
      suffix: '',
      dateOfBirth: '1990-01-15',
      genderCode: 'male',
      civilStatusCode: 'single',
      barangayCode: 'bocohan',
      completeAddress: '123 Rizal Street',
      contactNumber: '09171234567',
      emailAddress: 'kin@example.com',
      yearsOfResidency: '5',
    });
  });

  it('turns nulls into empty strings so inputs stay controlled', () => {
    const values = mapApplicationToFormValues({ ...VIEW_ROW, middle_name: null, suffix: null });
    expect(values.middleName).toBe('');
    expect(values.suffix).toBe('');
  });

  it('stringifies years_of_residency for a text input', () => {
    expect(mapApplicationToFormValues({ ...VIEW_ROW, years_of_residency: 0 }).yearsOfResidency).toBe('0');
  });
});

describe('mapResubmitToParams', () => {
  const VALUES = mapApplicationToFormValues(VIEW_ROW);

  it('emits the literal p_* parameter names the RPC declares', () => {
    expect(Object.keys(mapResubmitToParams('app-1', VALUES)).sort()).toEqual([
      'p_application_id',
      'p_barangay_code',
      'p_civil_status_code',
      'p_complete_address',
      'p_contact_number',
      'p_date_of_birth',
      'p_email_address',
      'p_first_name',
      'p_gender_code',
      'p_last_name',
      'p_middle_name',
      'p_suffix',
      'p_voter_id_number',
      'p_years_of_residency',
    ]);
  });

  it('never sends p_privacy_consent — update_yellow_card_application has no such parameter', () => {
    expect(mapResubmitToParams('app-1', VALUES)).not.toHaveProperty('p_privacy_consent');
  });

  it('trims text and coerces years of residency to a number', () => {
    const params = mapResubmitToParams('app-1', {
      ...VALUES,
      firstName: '  Kin  ',
      completeAddress: '  123 Rizal Street  ',
      yearsOfResidency: '5',
    });
    expect(params.p_first_name).toBe('Kin');
    expect(params.p_complete_address).toBe('123 Rizal Street');
    expect(params.p_years_of_residency).toBe(5);
  });

  it('null-ifies blank optional names rather than sending empty strings', () => {
    const params = mapResubmitToParams('app-1', { ...VALUES, middleName: '   ', suffix: '' });
    expect(params.p_middle_name).toBeNull();
    expect(params.p_suffix).toBeNull();
  });

  it('throws YellowCardSubmitError when a required field is blank', () => {
    expect(() => mapResubmitToParams('app-1', { ...VALUES, firstName: '' })).toThrow(YellowCardSubmitError);
    expect(() => mapResubmitToParams('app-1', { ...VALUES, lastName: '   ' })).toThrow(YellowCardSubmitError);
    expect(() => mapResubmitToParams('app-1', { ...VALUES, completeAddress: '' })).toThrow(YellowCardSubmitError);
    expect(() => mapResubmitToParams('app-1', { ...VALUES, voterIdNumber: '' })).toThrow(YellowCardSubmitError);
  });

  it('throws YellowCardSubmitError when completeAddress exceeds LIMITS.address', () => {
    expect(() => mapResubmitToParams('app-1', { ...VALUES, completeAddress: 'a'.repeat(301) })).toThrow(
      YellowCardSubmitError,
    );
  });

  it('throws YellowCardSubmitError when a name exceeds LIMITS.name', () => {
    expect(() => mapResubmitToParams('app-1', { ...VALUES, firstName: 'a'.repeat(81) })).toThrow(
      YellowCardSubmitError,
    );
  });

  it('throws YellowCardSubmitError on a malformed email or mobile number', () => {
    expect(() => mapResubmitToParams('app-1', { ...VALUES, emailAddress: 'not-an-email' })).toThrow(
      YellowCardSubmitError,
    );
    expect(() => mapResubmitToParams('app-1', { ...VALUES, contactNumber: '12345' })).toThrow(
      YellowCardSubmitError,
    );
  });

  it('throws YellowCardSubmitError when yearsOfResidency is not a valid bounded integer', () => {
    expect(() => mapResubmitToParams('app-1', { ...VALUES, yearsOfResidency: 'abc' })).toThrow(
      YellowCardSubmitError,
    );
    expect(() => mapResubmitToParams('app-1', { ...VALUES, yearsOfResidency: '-1' })).toThrow(
      YellowCardSubmitError,
    );
    expect(() => mapResubmitToParams('app-1', { ...VALUES, yearsOfResidency: '121' })).toThrow(
      YellowCardSubmitError,
    );
  });
});

describe('computeAgeError', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Pin the clock so these assertions do not depend on the day the suite runs. */
  function pinToday(isoDate: string) {
    vi.useFakeTimers();
    const [y, m, d] = isoDate.split('-').map(Number);
    vi.setSystemTime(new Date(y, m - 1, d, 12, 0, 0));
  }

  it('returns null for an empty date so the banner stays hidden before input', () => {
    expect(computeAgeError('')).toBeNull();
  });

  it('accepts someone who turned 18 today', () => {
    pinToday('2026-08-07');
    expect(computeAgeError('2008-08-07')).toBeNull();
  });

  it('rejects someone one day short of 18', () => {
    pinToday('2026-08-07');
    expect(computeAgeError('2008-08-08')).toBe('❌ You must be 18 years or older to apply.');
  });

  it('accepts someone comfortably over 18', () => {
    pinToday('2026-08-07');
    expect(computeAgeError('1990-01-15')).toBeNull();
  });

  it('rejects a clearly underage date', () => {
    pinToday('2026-08-07');
    expect(computeAgeError('2014-08-07')).toBe('❌ You must be 18 years or older to apply.');
  });

  it('handles a leap-day run date without drifting', () => {
    pinToday('2028-02-29');
    expect(computeAgeError('2010-02-28')).toBeNull();
    expect(computeAgeError('2010-03-01')).toBe('❌ You must be 18 years or older to apply.');
  });

  // Regression: computeAgeError now delegates its underlying math to
  // birthDateError (single source of truth for date math), but keeps its own
  // citizen-facing message for backward compatibility with the assertions
  // above. A future date of birth must still be rejected.
  it('rejects a future date of birth via the shared birthDateError delegate', () => {
    pinToday('2026-08-07');
    expect(computeAgeError('2999-01-01')).toBe('❌ You must be 18 years or older to apply.');
  });
});

describe('translateSubmitError', () => {
  it('prefers the errcode over message text when both are present', () => {
    expect(translateSubmitError('duplicate key value violates unique constraint', '23505')).toBe(
      'You already have an active Yellow Card application. Withdraw it from your dashboard before applying again.',
    );
  });

  it('maps 22023 (validation) to a required-fields message via code', () => {
    expect(translateSubmitError('some internal validation detail', '22023')).toBe(
      'Please check that all required fields are filled in correctly.',
    );
  });

  it('falls back to substring matching when no code is given (back-compat, single-arg call)', () => {
    expect(translateSubmitError('Please complete your profile first')).toBe(
      'Please complete your profile before applying for a Yellow Card.',
    );
    expect(translateSubmitError('consent is required')).toBe(
      'You must accept the Data Privacy consent to proceed.',
    );
    expect(translateSubmitError('you already have a live application')).toBe(
      'You already have an active Yellow Card application. Withdraw it from your dashboard before applying again.',
    );
  });

  it('falls back generically for an unrecognised code and message', () => {
    expect(translateSubmitError('unexpected server error', 'XX999')).toBe(
      'We could not submit your application right now. Please try again later.',
    );
  });
});

describe('translateResubmitError', () => {
  it('tells an expired session apart from the other two 42501 guards', () => {
    expect(
      translateResubmitError('42501', 'update_yellow_card_application: no authenticated caller'),
    ).toBe('Your session has expired. Please sign in again.');
  });

  it('translates the ownership guard', () => {
    expect(
      translateResubmitError('42501', 'update_yellow_card_application: that application is not yours'),
    ).toBe("You don't have access to that application.");
  });

  it('translates the stale-status guard, which also raises 42501', () => {
    expect(
      translateResubmitError('42501', 'update_yellow_card_application: YC-2026-000091 is approved, not revision_requested'),
    ).toBe('This application is no longer awaiting your changes. Check your dashboard for its current status.');
  });

  it('translates the missing-row guard', () => {
    expect(translateResubmitError('P0002', 'update_yellow_card_application: no application abc')).toBe(
      "We couldn't find that application.",
    );
  });

  it('translates the years-of-residency guard', () => {
    expect(
      translateResubmitError('22023', 'update_yellow_card_application: years of residency must be zero or more'),
    ).toBe('Years of residency must be zero or more.');
  });

  it('falls back generically and never leaks raw Postgres text', () => {
    const out = translateResubmitError(undefined, 'FATAL: connection to server at "db" failed');
    expect(out).toBe('We could not resubmit your application right now. Please try again later.');
    expect(out).not.toContain('FATAL');
  });

  it('falls back for a 42501 whose message matches no known guard', () => {
    expect(translateResubmitError('42501', 'permission denied for something new')).toBe(
      'We could not resubmit your application right now. Please try again later.',
    );
  });
});

describe('translateUploadError', () => {
  it('translates an oversize file at any stage', () => {
    expect(
      translateUploadError('upload', undefined, 'The object exceeded the maximum allowed size'),
    ).toBe('That file is too large. Please upload a file under 5MB.');
  });

  it('translates a bad mime type', () => {
    expect(
      translateUploadError('reserve', undefined, 'invalid_mime_type: not an accepted content type'),
    ).toBe('That file type is not accepted. Please upload a JPG, PNG or PDF.');
  });

  it('translates a 42501 as the application no longer accepting uploads', () => {
    expect(
      translateUploadError('reserve', '42501', 'request_yellow_card_document_upload: YC-2026-000091 is approved, not accepting uploads'),
    ).toBe('This application is not accepting document uploads right now. Check your dashboard for its current status.');
  });

  it('translates a P0002 as application not found', () => {
    expect(translateUploadError('reserve', 'P0002', 'no application abc')).toBe(
      "We couldn't find that application.",
    );
  });

  it('falls back to a confirm-specific message when the confirm stage fails generically', () => {
    expect(translateUploadError('confirm', undefined, 'unexpected server error')).toBe(
      'Your file was uploaded but we could not finish attaching it. Please try again.',
    );
  });

  it('falls back generically for reserve/upload stages and never echoes the raw message', () => {
    const out = translateUploadError('upload', undefined, 'ECONNRESET at bucket voter-id-documents-xyz123');
    expect(out).toBe('We could not upload your document right now. Please try again.');
    expect(out).not.toContain('ECONNRESET');
    expect(out).not.toContain('voter-id-documents-xyz123');
  });
});

const VALID_SUBMIT_FIELDS: YellowCardApplicationFields = {
  firstName: 'Juan',
  lastName: 'Dela Cruz',
  dateOfBirth: '1990-01-15',
  genderCode: 'male',
  civilStatusCode: 'single',
  barangayCode: 'bocohan',
  completeAddress: '123 Rizal Street',
  contactNumber: '09171234567',
  emailAddress: 'juan@example.com',
  yearsOfResidency: 5,
  voterIdNumber: '123-456-789',
  privacyConsent: true,
};

/**
 * submitApplication only validates on the live path (mock mode is a
 * client-side fake with no server to protect), so these tests install a fake
 * Supabase client (pattern copied from authService.test.ts's logout-failure
 * test) and assert the RPC is never reached when the fields are bad.
 */
describe('yellowCardService.submitApplication field validation (live path)', () => {
  function withFakeClient() {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'x', reference_number: 'YC-2026-000001' }, error: null });
    const fakeClient = { rpc } as unknown as ReturnType<typeof supabaseClientModule.getSupabaseClient>;
    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(fakeClient);
    return { rpc, spy };
  }

  it('rejects an oversize voter ID number without calling the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await expect(
        yellowCardService.submitApplication({ ...VALID_SUBMIT_FIELDS, voterIdNumber: 'a'.repeat(121) }),
      ).rejects.toThrow(YellowCardSubmitError);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects an oversize complete address without calling the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await expect(
        yellowCardService.submitApplication({ ...VALID_SUBMIT_FIELDS, completeAddress: 'a'.repeat(301) }),
      ).rejects.toThrow(YellowCardSubmitError);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects a bad email address without calling the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await expect(
        yellowCardService.submitApplication({ ...VALID_SUBMIT_FIELDS, emailAddress: 'not-an-email' }),
      ).rejects.toThrow(YellowCardSubmitError);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects a malformed mobile number without calling the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await expect(
        yellowCardService.submitApplication({ ...VALID_SUBMIT_FIELDS, contactNumber: '12345' }),
      ).rejects.toThrow(YellowCardSubmitError);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects an out-of-range years of residency without calling the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await expect(
        yellowCardService.submitApplication({ ...VALID_SUBMIT_FIELDS, yearsOfResidency: 121 }),
      ).rejects.toThrow(YellowCardSubmitError);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('accepts valid fields and calls the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await yellowCardService.submitApplication({ ...VALID_SUBMIT_FIELDS });
      expect(rpc).toHaveBeenCalledWith('submit_yellow_card_application', expect.any(Object));
    } finally {
      spy.mockRestore();
    }
  });
});

describe('yellowCardService revise methods in mock mode (no backend)', () => {
  const VALUES = mapApplicationToFormValues(VIEW_ROW);

  it('getMyApplication resolves null rather than fabricating a row', async () => {
    expect(await yellowCardService.getMyApplication(VIEW_ROW.id)).toBeNull();
  });

  it('resubmitApplication resolves without throwing', async () => {
    await expect(yellowCardService.resubmitApplication(VIEW_ROW.id, VALUES)).resolves.toBeUndefined();
  });
});

describe('translateWithdrawError', () => {
  it('reports a 42501 refusal as no longer withdrawable', () => {
    expect(translateWithdrawError('42501')).toBe('This application can no longer be withdrawn.');
  });

  it('never leaks raw Postgres text for an unknown code', () => {
    const msg = translateWithdrawError('XX999');
    expect(msg).toMatch(/could not withdraw/i);
    expect(msg).not.toMatch(/constraint|relation|null value/i);
  });
});

describe('yellowCardService.withdrawApplication in mock mode (no backend)', () => {
  it('resolves without throwing', async () => {
    await expect(yellowCardService.withdrawApplication('app-1')).resolves.toBeUndefined();
  });
});

describe('verifyCard', () => {
  // Anon-callable by design: the barangay official scanning the QR is signed
  // out, and usually not a portal user at all.
  it('resolves not-found in mock mode rather than inventing a card', async () => {
    expect(await verifyCard('11111111-2222-3333-4444-555555555555')).toEqual({ kind: 'not-found' });
  });

  it('resolves not-found for a blank token without calling anything', async () => {
    const { rpc, spy } = withRpc({ data: [], error: null });
    try {
      expect(await verifyCard('')).toEqual({ kind: 'not-found' });
      expect(await verifyCard('   ')).toEqual({ kind: 'not-found' });
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  function withClient(rpc: ReturnType<typeof vi.fn>) {
    const fakeClient = { rpc } as unknown as ReturnType<typeof supabaseClientModule.getSupabaseClient>;
    return vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(fakeClient);
  }

  /** A fake client whose `verify_yellow_card` call resolves `answer`, as supabase-js does. */
  function withRpc(answer: { data: unknown; error: unknown; status?: number }) {
    // The supabase-js builder is a thenable that also takes `.abortSignal()`.
    const rpc = vi.fn(() => Object.assign(Promise.resolve(answer), { abortSignal() { return this; } }));
    return { rpc, spy: withClient(rpc) };
  }

  it('resolves found with the card the RPC returned for the trimmed token', async () => {
    const card = { holder_name: 'Juan Dela Cruz', status: 'active' };
    const { rpc, spy } = withRpc({ data: [card], error: null, status: 200 });
    try {
      expect(await verifyCard('  tok-1 ')).toEqual({ kind: 'found', card });
      expect(rpc).toHaveBeenCalledWith('verify_yellow_card', { p_token: 'tok-1' });
    } finally {
      spy.mockRestore();
    }
  });

  // Unknown and deleted tokens both come back as zero rows; a malformed one as
  // 22P02 (`p_token` is a uuid). All three must look the same to a prober.
  it.each([
    ['zero rows', { data: [], error: null, status: 200 }],
    ['a malformed token (22P02)', { data: null, error: { code: '22P02', message: 'invalid input syntax for type uuid' }, status: 400 }],
  ])('resolves not-found for %s', async (_case, answer) => {
    const { spy } = withRpc(answer);
    try {
      expect(await verifyCard('tok-1')).toEqual({ kind: 'not-found' });
    } finally {
      spy.mockRestore();
    }
  });

  // supabase-js does not throw on a network failure: it resolves an error with
  // status 0. A failed request says nothing about the card (issue #52).
  it.each([
    ['a network failure (status 0)', { data: null, error: { code: '', message: 'TypeError: Failed to fetch' }, status: 0 }],
    ['an HTTP 503', { data: null, error: { code: '', message: 'Service Unavailable' }, status: 503 }],
    ['any other RPC error', { data: null, error: { code: '42501', message: 'permission denied' }, status: 401 }],
  ])('resolves unavailable for %s', async (_case, answer) => {
    const { spy } = withRpc(answer);
    try {
      expect(await verifyCard('tok-1')).toEqual({ kind: 'unavailable' });
    } finally {
      spy.mockRestore();
    }
  });

  // supabase-js sets no timeout of its own, so on a weak signal a request can
  // hang and leave the Verifier on "Checking this card…" indefinitely.
  it('gives up on a request that hangs and resolves unavailable', async () => {
    vi.useFakeTimers();
    // A request that never answers until aborted, then resolves the way
    // supabase-js resolves an aborted fetch.
    const rpc = vi.fn(() => ({
      abortSignal: (signal: AbortSignal) =>
        new Promise((resolve) =>
          signal.addEventListener('abort', () =>
            resolve({ data: null, error: { code: '', message: 'AbortError: This operation was aborted' }, status: 0 }),
          ),
        ),
    }));
    const spy = withClient(rpc);
    try {
      const result = verifyCard('tok-1');
      await vi.advanceTimersByTimeAsync(15_000);
      expect(await result).toEqual({ kind: 'unavailable' });
    } finally {
      spy.mockRestore();
      vi.useRealTimers();
    }
  });
});
