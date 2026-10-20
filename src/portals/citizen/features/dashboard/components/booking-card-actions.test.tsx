import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingCardActions, { formatHoldRemaining } from '@/portals/citizen/features/dashboard/components/booking-card-actions';
import type { MyBooking } from '@/portals/citizen/features/booking/types';

vi.mock('@/portals/citizen/features/booking/components/steps/lcc-step-6-payment', () => ({
  default: () => <div data-testid="payment-step">payment form</div>,
}));

// The upload step loads catalogs and talks to storage; here only WHICH upload
// the card offers matters — the first one, or a replacement.
vi.mock('@/portals/citizen/features/booking/components/steps/lcc-step-org-document', () => ({
  default: ({ mode = 'claim' }: { mode?: string }) => <div data-testid={`org-document-${mode}`} />,
}));

const booking = (overrides: Partial<MyBooking> = {}): MyBooking => ({
  id: 'bk-1',
  reference_number: 'BK-2026-000001',
  status: 'awaiting_payment',
  cancellation_reason: null,
  event_title: 'Annual Conference',
  event_type_code: 'conference',
  event_type_label: 'Conference',
  classification_code: 'commercial',
  rate_tier: 'commercial',
  tier_verified: true,
  venue_code: 'atrium',
  venue_label: 'Atrium',
  estimated_headcount: 200,
  special_requirements: null,
  organization_name: null,
  contact_person: 'Juan Dela Cruz',
  contact_number: '09171234567',
  email_address: 'juan@example.com',
  event_date: '2026-12-01',
  start_time: '08:00',
  duration_hours: 6,
  rehearsal_rate_type: null,
  total_fee: 20000,
  downpayment_pct: 50,
  downpayment_amount: 10000,
  balance_amount: 10000,
  quoted_at: '2026-08-20T02:00:00Z',
  hold_expires_at: null,
  terms_accepted_at: '2026-08-19T02:00:00Z',
  submitted_at: '2026-08-19T02:00:00Z',
  confirmed_at: null,
  balance_settled_at: null,
  completed_at: null,
  payment_count: 0,
  document_count: 1,
  tier_revision_reason: null,
  ...overrides,
});

/** A discounted booking with its Tier Claim undecided (DB l77b). */
const discounted = (overrides: Partial<MyBooking> = {}) =>
  booking({ rate_tier: 'discounted', tier_verified: false, classification_code: 'ngo', ...overrides });

/** A Hold still running, an hour from now. */
const soon = () => new Date(Date.now() + 3_600_000).toISOString();

describe('formatHoldRemaining', () => {
  const now = Date.UTC(2026, 7, 25, 12, 0, 0);

  it('reports days and hours for a long hold', () => {
    expect(formatHoldRemaining('2026-08-27T15:00:00Z', now)).toBe('2d 3h remaining');
  });

  it('reports hours and minutes inside a day', () => {
    expect(formatHoldRemaining('2026-08-25T17:30:00Z', now)).toBe('5h 30m remaining');
  });

  it('reports minutes alone in the final hour', () => {
    expect(formatHoldRemaining('2026-08-25T12:45:00Z', now)).toBe('45m remaining');
  });

  it('is null once the hold has lapsed, so the UI can say so instead of counting down', () => {
    expect(formatHoldRemaining('2026-08-25T11:00:00Z', now)).toBeNull();
  });

  it('is null when there is no hold or the value will not parse', () => {
    expect(formatHoldRemaining(null, now)).toBeNull();
    expect(formatHoldRemaining('not-a-date', now)).toBeNull();
  });
});

describe('BookingCardActions', () => {
  // The gap this closes: LCCStep6Payment was reachable only inside a live
  // wizard session, so a booking quoted after the citizen closed the tab had no
  // screen anywhere that let them pay — while LCCStep5Pending promised one.
  it('offers a resumable pay-now for an awaiting_payment booking', async () => {
    render(<BookingCardActions booking={booking()} onChanged={vi.fn()} />);
    expect(screen.getByText(/Downpayment due/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /pay downpayment/i }));
    expect(screen.getByTestId('payment-step')).toBeInTheDocument();
  });

  it('shows the balance as payable in person once confirmed', () => {
    render(<BookingCardActions booking={booking({ status: 'confirmed' })} onChanged={vi.fn()} />);
    expect(screen.getByText(/payable in person/i)).toBeInTheDocument();
  });

  // A bare "Cancelled" told a citizen nothing about whether they had been
  // rejected, cancelled themselves, or run out the payment clock.
  it('explains why a cancelled booking was cancelled', () => {
    render(
      <BookingCardActions
        booking={booking({ status: 'cancelled', cancellation_reason: 'expired_unpaid' })}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText(/hold expired/i)).toBeInTheDocument();
  });

  it('distinguishes a staff rejection from an expiry', () => {
    render(
      <BookingCardActions
        booking={booking({ status: 'cancelled', cancellation_reason: 'rejected_by_staff' })}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText(/not approved by City Hall/i)).toBeInTheDocument();
  });

  it('offers cancellation only from a status the DB actually accepts', () => {
    const { rerender } = render(<BookingCardActions booking={booking()} onChanged={vi.fn()} />);
    expect(screen.getByRole('button', { name: /cancel booking/i })).toBeInTheDocument();

    rerender(<BookingCardActions booking={booking({ status: 'completed' })} onChanged={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument();
  });

  // Money on file means the citizen needs a human, not a button whose only
  // possible outcome is a 42501 refusal.
  it('sends a paid-up citizen to City Hall instead of showing a doomed button', () => {
    render(
      <BookingCardActions booking={booking({ status: 'payment_verification' })} onChanged={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument();
    expect(screen.getByText(/contact the Lucena City Hall/i)).toBeInTheDocument();
  });

  it('requires a reason before it will cancel', async () => {
    render(<BookingCardActions booking={booking()} onChanged={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel booking/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm cancellation/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/why you are cancelling/i);
  });

  it('explains a cancellation for an unanswered Revision Request', () => {
    render(
      <BookingCardActions
        booking={booking({ status: 'cancelled', cancellation_reason: 'expired_unrevised' })}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText(/corrected organisation document was not uploaded/i)).toBeInTheDocument();
  });
});

describe('BookingCardActions, Tier Review (SCRUM-198)', () => {
  it('says a booking in Tier Review owes nothing yet, with the provisional downpayment', () => {
    render(
      <BookingCardActions
        booking={discounted({ status: 'awaiting_tier_review', downpayment_amount: 15000 })}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText(/under review/i)).toBeInTheDocument();
    expect(screen.getByText(/no payment is due yet/i)).toBeInTheDocument();
    expect(screen.getByText(/₱15,000\.00 if your discount claim is accepted/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pay downpayment/i })).toBeNull();
    // Cancelling costs nothing here: no money is on file.
    expect(screen.getByRole('button', { name: /cancel booking/i })).toBeInTheDocument();
  });

  it('shows a Revision Request: what to fix, how long is left, and the corrected upload', () => {
    render(
      <BookingCardActions
        booking={discounted({
          status: 'awaiting_resubmission',
          hold_expires_at: new Date(Date.now() + 26 * 3_600_000).toISOString(),
          tier_revision_reason: 'The registration certificate is unreadable.',
        })}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText('The registration certificate is unreadable.')).toBeInTheDocument();
    expect(screen.getByText(/1d \d+h remaining/)).toBeInTheDocument();
    expect(screen.getByTestId('org-document-resubmission')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel booking/i })).toBeInTheDocument();
  });

  it('says plainly when the Revision Request has run out', () => {
    render(
      <BookingCardActions
        booking={discounted({
          status: 'awaiting_resubmission',
          hold_expires_at: '2020-01-01T00:00:00Z',
          tier_revision_reason: 'Unreadable.',
        })}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText(/time to upload a corrected document has passed/i)).toBeInTheDocument();
    expect(screen.queryByTestId('org-document-resubmission')).toBeNull();
  });

  it('lets a citizen who left the wizard upload the first document, or skip', () => {
    render(
      <BookingCardActions
        booking={discounted({ status: 'pending', hold_expires_at: soon() })}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByTestId('org-document-claim')).toBeInTheDocument();
  });

  /**
   * SCRUM-196, folded into SCRUM-198: the control that REPLACES an
   * organisation document appears only in awaiting_resubmission, and never on
   * a booking whose Tier Claim was accepted. Under l71 an accepted document
   * could be swapped and tier_verified stayed true on a file nobody reviewed.
   */
  it.each([
    ['pending', false],
    ['awaiting_tier_review', false],
    ['awaiting_quote', true],
    ['awaiting_payment', true],
    ['payment_verification', true],
    ['confirmed', true],
    ['fully_paid', true],
    ['completed', true],
    ['cancelled', false],
  ])('offers no document replacement on a %s booking (tier_verified %s)', (status, verified) => {
    render(
      <BookingCardActions
        booking={discounted({
          status,
          tier_verified: verified,
          hold_expires_at: soon(),
          tier_revision_reason: 'Unreadable.',
          cancellation_reason: status === 'cancelled' ? 'rejected_by_staff' : null,
        })}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('org-document-resubmission')).toBeNull();
  });

  it('never offers a replacement once the claim is accepted, even in awaiting_resubmission', () => {
    // Unreachable by the DB's state machine; pinned so the guard is not only
    // the status.
    render(
      <BookingCardActions
        booking={discounted({
          status: 'awaiting_resubmission',
          tier_verified: true,
          hold_expires_at: soon(),
          tier_revision_reason: 'Unreadable.',
        })}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('org-document-resubmission')).toBeNull();
  });

  it('offers pay and cancel side by side after a rejected claim, at the commercial amount', () => {
    // A commercial booking carrying a Revision Request's reason had its claim
    // rejected on the second look (DB l77b header, section 6).
    render(
      <BookingCardActions
        booking={booking({
          status: 'awaiting_payment',
          rate_tier: 'commercial',
          tier_verified: false,
          downpayment_amount: 30000,
          hold_expires_at: soon(),
          tier_revision_reason: 'Unreadable.',
        })}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText(/was not accepted/i)).toBeInTheDocument();
    expect(screen.getByText(/commercial rate/i)).toBeInTheDocument();
    const pay = screen.getByRole('button', { name: /pay downpayment/i });
    const cancel = screen.getByRole('button', { name: /cancel booking/i });
    expect(pay.parentElement).toBe(cancel.parentElement);
  });

  it('says nothing about a rejected claim on an ordinary commercial booking', () => {
    render(<BookingCardActions booking={booking()} onChanged={vi.fn()} />);
    expect(screen.queryByText(/was not accepted/i)).toBeNull();
  });
});
