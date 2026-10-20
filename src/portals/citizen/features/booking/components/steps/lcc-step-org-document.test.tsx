import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LCCStepOrgDocument from '@/portals/citizen/features/booking/components/steps/lcc-step-org-document';
import { bookingService, BookingSubmitError } from '@/portals/citizen/features/booking/lib/booking';
import { catalogService } from '@/portals/citizen/lib/supabase/catalogs';

const RATES = [
  { venue_code: 'atrium', tier: 'commercial', base_fee: 60000, extension_hourly: 10000, hourly_rate: null, requires_quote: false },
  { venue_code: 'atrium', tier: 'discounted', base_fee: 30000, extension_hourly: 5000, hourly_rate: null, requires_quote: false },
  { venue_code: 'full_facility', tier: 'commercial', base_fee: null, extension_hourly: null, hourly_rate: null, requires_quote: true },
];

const SKIPPED = {
  id: 'bk-1',
  reference_number: 'BK-2026-000040',
  status: 'awaiting_payment',
  rate_tier: 'commercial',
  total_fee: 60000,
  downpayment_amount: 30000,
};

beforeEach(() => {
  vi.spyOn(catalogService, 'getBookingVenueRates').mockResolvedValue(RATES);
  vi.spyOn(catalogService, 'getRehearsalRates').mockResolvedValue([]);
  vi.spyOn(catalogService, 'getBookingConfig').mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderClaim(over: Partial<React.ComponentProps<typeof LCCStepOrgDocument>> = {}) {
  const onUploaded = vi.fn();
  const onSkipped = vi.fn();
  render(
    <LCCStepOrgDocument
      bookingId="bk-1"
      venueCode="atrium"
      durationHours={6}
      rehearsalRateType={null}
      onUploaded={onUploaded}
      onSkipped={onSkipped}
      {...over}
    />,
  );
  return { onUploaded, onSkipped };
}

const pdf = () => new File(['%PDF-1.4'], 'sec-registration.pdf', { type: 'application/pdf' });

describe('LCCStepOrgDocument, claiming the discount', () => {
  it('says plainly that skipping gives up the discount, with the commercial downpayment', async () => {
    // SCRUM-198 story 8: the citizen sees the real cost before choosing.
    renderClaim();
    expect(await screen.findByText(/₱30,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/gives up the discounted rate/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue at the commercial rate/i })).toBeInTheDocument();
  });

  it('says a quote comes first when the commercial venue needs one', async () => {
    renderClaim({ venueCode: 'full_facility' });
    expect(await screen.findByText(/quote the commercial price before you pay/i)).toBeInTheDocument();
  });

  it('skips through the server and hands back the repriced booking', async () => {
    // The skip is give_up_tier_claim, never a screen change: the city sets the price.
    const skip = vi.spyOn(bookingService, 'giveUpTierClaim').mockResolvedValue(SKIPPED);
    const user = userEvent.setup();
    const { onSkipped, onUploaded } = renderClaim();

    await user.click(screen.getByRole('button', { name: /continue at the commercial rate/i }));

    expect(skip).toHaveBeenCalledWith('bk-1');
    expect(onSkipped).toHaveBeenCalledWith(SKIPPED);
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it('stays put and says why when the server refuses the skip', async () => {
    vi.spyOn(bookingService, 'giveUpTierClaim').mockRejectedValue(
      new Error('This booking can no longer continue without the discount.'),
    );
    const user = userEvent.setup();
    const { onSkipped } = renderClaim();

    await user.click(screen.getByRole('button', { name: /continue at the commercial rate/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/can no longer continue without the discount/i);
    expect(onSkipped).not.toHaveBeenCalled();
  });

  it('uploads the document and moves on to Tier Review', async () => {
    const upload = vi.spyOn(bookingService, 'uploadBookingDocument').mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { onUploaded } = renderClaim();

    await user.upload(screen.getByLabelText('Organisation Document'), pdf());
    await user.click(screen.getByRole('button', { name: /upload and send for review/i }));

    expect(upload).toHaveBeenCalledWith('bk-1', 'org_document', expect.any(File), undefined, expect.any(Object));
    expect(onUploaded).toHaveBeenCalled();
  });

  it('says why when the server refuses the upload, rather than inviting a retry that cannot work', async () => {
    // confirm_upload raises 42501 once the Hold has ended or the booking has
    // moved on; translateBookingError has already written that for a citizen.
    vi.spyOn(bookingService, 'uploadBookingDocument').mockRejectedValue(
      new BookingSubmitError('This booking is not accepting documents right now.', '42501'),
    );
    const user = userEvent.setup();
    renderClaim();

    await user.upload(screen.getByLabelText('Organisation Document'), pdf());
    await user.click(screen.getByRole('button', { name: /upload and send for review/i }));

    expect(await screen.findByText(/not accepting documents right now/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry upload/i })).toBeNull();
  });

  it('offers a retry when the upload failed for an unknown reason', async () => {
    vi.spyOn(bookingService, 'uploadBookingDocument').mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    renderClaim();

    await user.upload(screen.getByLabelText('Organisation Document'), pdf());
    await user.click(screen.getByRole('button', { name: /upload and send for review/i }));

    expect(await screen.findByRole('button', { name: /retry upload/i })).toBeInTheDocument();
  });

  it('no longer warns that review can reprice after payment', () => {
    // The l71 copy said staff "may re-price your booking"; since l77b nothing
    // is paid until the claim is decided.
    renderClaim();
    expect(screen.queryByText(/may re-price/i)).toBeNull();
    expect(screen.getByText(/before you pay anything/i)).toBeInTheDocument();
  });
});

describe('LCCStepOrgDocument, answering a Revision Request', () => {
  it('offers the corrected upload and no skip', () => {
    renderClaim({ mode: 'resubmission', onSkipped: undefined });
    expect(screen.getByRole('button', { name: /upload corrected document/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /commercial rate/i })).toBeNull();
  });
});
