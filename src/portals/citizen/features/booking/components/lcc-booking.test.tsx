import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LCCBooking from '@/portals/citizen/features/booking/components/lcc-booking';
import { catalogService } from '@/portals/citizen/lib/supabase/catalogs';
import { bookingService } from '@/portals/citizen/features/booking/lib/booking';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/portals/citizen/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'citizen-1' } }),
}));

// The rate card from the 2026-10-01 demo run: Atrium is a 6-hour base fee, and
// rehearsal_practice carries no hourly_rate of its own since DB layer l55 —
// its price lives in public_booking_rehearsal_rates.
const VENUES = [
  { code: 'atrium', label: 'Atrium', capacity_label: null, is_hourly: false, sort_order: 1 },
  { code: 'rehearsal_practice', label: 'Rehearsal / Practice', capacity_label: null, is_hourly: true, sort_order: 4 },
];
const VENUE_RATES = [
  { venue_code: 'atrium', tier: 'commercial', base_fee: 60000, extension_hourly: 10000, hourly_rate: null, requires_quote: false },
  { venue_code: 'atrium', tier: 'discounted', base_fee: 30000, extension_hourly: 5000, hourly_rate: null, requires_quote: false },
  { venue_code: 'rehearsal_practice', tier: 'commercial', base_fee: null, extension_hourly: null, hourly_rate: null, requires_quote: false },
  { venue_code: 'rehearsal_practice', tier: 'discounted', base_fee: null, extension_hourly: null, hourly_rate: null, requires_quote: false },
];
const REHEARSAL_RATES = [
  { code: 'no_ac_day', label: 'No Air Conditioning (Day)', hourly_rate: 1200, sort_order: 1 },
  { code: 'with_ac', label: 'With Air Conditioning', hourly_rate: 2000, sort_order: 2 },
];

beforeEach(() => {
  vi.spyOn(catalogService, 'getBookingClassifications').mockResolvedValue([{ code: 'ngo', label: 'NGO' }]);
  vi.spyOn(catalogService, 'getBookingEventTypes').mockResolvedValue([{ code: 'seminar', label: 'Seminar' }]);
  vi.spyOn(catalogService, 'getBookingVenueDetails').mockResolvedValue(VENUES);
  vi.spyOn(catalogService, 'getBookingVenueRates').mockResolvedValue(VENUE_RATES);
  vi.spyOn(catalogService, 'getRehearsalRates').mockResolvedValue(REHEARSAL_RATES);
  vi.spyOn(catalogService, 'getBookingConfig').mockResolvedValue(null);
  vi.spyOn(bookingService, 'getVenueAvailability').mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Steps 1–3, choosing `venues` in order on step 2 — the last one sticks. */
async function walkToReview(user: ReturnType<typeof userEvent.setup>, venues: string[]) {
  await user.click(await screen.findByRole('radio', { name: /ngo/i }));
  await user.click(screen.getByRole('button', { name: /continue to venue selection/i }));

  await user.type(screen.getByPlaceholderText(/anniversary/i), 'Volunteer orientation');
  await user.selectOptions(screen.getByDisplayValue('Select type'), 'seminar');
  await user.type(screen.getByPlaceholderText('0'), '120');
  await user.type(screen.getByPlaceholderText('Full Name'), 'Juan dela Cruz');
  await user.type(screen.getByPlaceholderText('9XX XXX XXXX'), '9171234567');
  await user.type(screen.getByPlaceholderText('email@example.com'), 'juan@example.com');
  for (const venue of venues) {
    await user.click(await screen.findByRole('radio', { name: new RegExp(venue, 'i') }));
  }
  await user.click(screen.getByRole('button', { name: /continue to schedule/i }));

  // Next month's 15th is always in the future, whatever day the suite runs.
  await user.click(await screen.findByRole('button', { name: /next month/i }));
  const now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth() + 1, 15);
  await user.click(
    screen.getByRole('button', { name: day.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) }),
  );
  await user.selectOptions(screen.getByDisplayValue('Select...'), '08:00');
  await user.click(screen.getByRole('button', { name: /review booking summary/i }));
}

function feeShown(label: RegExp) {
  return within(screen.getByText(label).parentElement as HTMLElement).getByText(/₱|—|quote/);
}

/**
 * SCRUM-187. The step-2 effect that keeps the rehearsal rate type on a catalog
 * code ran for every venue, so a non-hourly venue's '' was reset to the first
 * rehearsal code — and the review step then priced Atrium at 6 h × ₱1,200.
 *
 * Each case clicks through three wizard steps, ~3.5 s alone; under a full-suite
 * run they crossed vitest's 5 s default and failed. 20 s leaves room for load.
 */
describe('LCC wizard, rehearsal then Atrium', { timeout: 20_000 }, () => {
  it('prices Atrium from its base fee, not the rehearsal hourly rate', async () => {
    const user = userEvent.setup();
    render(<LCCBooking />);
    await walkToReview(user, ['rehearsal', 'atrium']);

    await screen.findByText(/standard rate/i);
    expect(feeShown(/standard rate/i)).toHaveTextContent('₱60,000.00');
    expect(feeShown(/discounted rate/i)).toHaveTextContent('₱30,000.00');
  });

  it('submits no rehearsal rate type for Atrium', async () => {
    const submit = vi.spyOn(bookingService, 'submitBooking').mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<LCCBooking />);
    await walkToReview(user, ['rehearsal', 'atrium']);

    await user.click(await screen.findByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /submit booking request/i }));

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0][0]).toMatchObject({ venueCode: 'atrium' });
    expect(submit.mock.calls[0][0].rehearsalRateType).toBeUndefined();
  });

  // Why the effect exists: the hourly venue must still land on a real catalog code.
  it('still defaults Rehearsal / Practice to a catalog rate code', async () => {
    const submit = vi.spyOn(bookingService, 'submitBooking').mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<LCCBooking />);
    await walkToReview(user, ['atrium', 'rehearsal']);

    expect(feeShown(/standard rate/i)).toHaveTextContent('₱1,200.00');

    await user.click(await screen.findByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /submit booking request/i }));
    expect(submit.mock.calls[0][0]).toMatchObject({ venueCode: 'rehearsal_practice', rehearsalRateType: 'no_ac_day' });
  });
});

/**
 * SCRUM-198 (DB l77b). The server parks a discounted booking in `pending`, and
 * the wizard follows its status: the organisation-document step, then either
 * the Tier Review wait (upload) or payment at the commercial rate (skip).
 */
describe('LCC wizard, after a discounted submit', { timeout: 20_000 }, () => {
  const PENDING = {
    id: 'bk-9',
    reference_number: 'BK-2026-000090',
    status: 'pending',
    rate_tier: 'discounted',
    total_fee: 30000,
    downpayment_amount: 15000,
  };

  async function submitDiscounted(user: ReturnType<typeof userEvent.setup>) {
    vi.spyOn(bookingService, 'submitBooking').mockResolvedValue(PENDING);
    render(<LCCBooking />);
    await walkToReview(user, ['atrium']);
    await user.click(await screen.findByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /submit booking request/i }));
    await screen.findByRole('heading', { name: /proof of organisation/i });
  }

  it('waits on Tier Review after the upload, showing the provisional downpayment and no way to pay', async () => {
    vi.spyOn(bookingService, 'uploadBookingDocument').mockResolvedValue(undefined);
    const user = userEvent.setup();
    await submitDiscounted(user);

    await user.upload(
      screen.getByLabelText('Organisation Document'),
      new File(['%PDF-1.4'], 'registration.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: /upload and send for review/i }));

    expect(await screen.findByRole('heading', { name: /under review/i })).toBeInTheDocument();
    expect(screen.getByText(/₱15,000\.00 if your discount claim is accepted/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /payment/i })).toBeNull();
  });

  it('goes to payment at the commercial amount the server set after a skip', async () => {
    vi.spyOn(bookingService, 'giveUpTierClaim').mockResolvedValue({
      ...PENDING,
      status: 'awaiting_payment',
      rate_tier: 'commercial',
      // Not the ₱30,000.00 the skip copy estimates: the screen must pay what
      // the server set, not what the client guessed.
      total_fee: 62000,
      downpayment_amount: 31000,
    });
    const user = userEvent.setup();
    await submitDiscounted(user);

    await user.click(screen.getByRole('button', { name: /continue at the commercial rate/i }));

    expect(await screen.findByRole('heading', { name: /payment submission/i })).toBeInTheDocument();
    expect(screen.getByText('₱31,000.00')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /under review/i })).toBeNull();
  });
});
