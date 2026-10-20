import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LCCStepTierReview from '@/portals/citizen/features/booking/components/steps/lcc-step-tier-review';

const REFERENCE = 'BK-2026-000042';

function renderStep(provisionalDownpayment: number | null = 15000) {
  return render(
    <LCCStepTierReview
      referenceNumber={REFERENCE}
      provisionalDownpayment={provisionalDownpayment}
      onGoToDashboard={vi.fn()}
      onBookAnother={vi.fn()}
    />,
  );
}

/**
 * SCRUM-198: after uploading the organisation document the citizen waits on
 * Tier Review, and no payment is asked for until the city has decided the
 * price.
 */
describe('LCCStepTierReview', () => {
  it('says the booking is under review and no payment is due yet', () => {
    renderStep();
    expect(screen.getByRole('heading', { name: /under review/i })).toBeInTheDocument();
    expect(screen.getByText(/no payment is due yet/i)).toBeInTheDocument();
  });

  it('labels the discounted downpayment as provisional', () => {
    renderStep(15000);
    expect(screen.getByText(/₱15,000\.00 if your discount claim is accepted/i)).toBeInTheDocument();
  });

  it('says a quote comes first when there is no provisional figure', () => {
    // Full Facility: an accepted claim goes to Quote, not straight to payment.
    renderStep(null);
    expect(screen.getByText(/City Hall will send you a quote/i)).toBeInTheDocument();
    expect(screen.queryByText(/₱/)).toBeNull();
  });

  it('offers no way to pay', () => {
    renderStep();
    expect(screen.queryByRole('button', { name: /pay/i })).toBeNull();
  });

  it('keeps the date held however long the review takes', () => {
    renderStep();
    expect(screen.getByText(/your date stays held/i)).toBeInTheDocument();
  });

  it('shows the reference with its receipt link', () => {
    renderStep();
    expect(screen.getByText(REFERENCE)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /acknowledgement receipt/i })).toHaveAttribute(
      'href',
      `/receipt/${REFERENCE}`,
    );
  });
});
