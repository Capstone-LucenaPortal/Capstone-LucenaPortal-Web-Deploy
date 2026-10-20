import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import LCCStep4Review from '@/portals/citizen/features/booking/components/steps/lcc-step-4-review';
import { EMPTY_BOOKING_FORM } from '@/portals/citizen/features/booking/lib/schedule';
import { catalogService } from '@/portals/citizen/lib/supabase/catalogs';

beforeEach(() => {
  vi.spyOn(catalogService, 'getBookingVenueRates').mockResolvedValue([
    { venue_code: 'atrium', tier: 'commercial', base_fee: 60000, extension_hourly: 10000, hourly_rate: null, requires_quote: false },
    { venue_code: 'atrium', tier: 'discounted', base_fee: 30000, extension_hourly: 5000, hourly_rate: null, requires_quote: false },
  ]);
  vi.spyOn(catalogService, 'getBookingConfig').mockResolvedValue(null);
  vi.spyOn(catalogService, 'getRehearsalRates').mockResolvedValue([
    { code: 'no_ac_day', label: 'No Air Conditioning (Day)', hourly_rate: 1200, sort_order: 1 },
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * SCRUM-187, second line of defence. Step 2 no longer leaves a rehearsal code on
 * a non-hourly venue, but the estimate must not trust that: a rehearsal hourly
 * rate is checked before base_fee, so a stray code reprices the whole booking.
 */
describe('LCCStep4Review', () => {
  it('ignores a stray rehearsal rate type on a non-hourly venue', async () => {
    render(
      <LCCStep4Review
        bookingData={{
          ...EMPTY_BOOKING_FORM,
          venueCode: 'atrium',
          venueLabel: 'Atrium',
          venueIsHourly: false,
          practiceRateType: 'no_ac_day',
          durationHours: 6,
          startTime: '08:00',
        }}
        onUpdate={vi.fn()}
        onSubmit={vi.fn()}
        onBack={vi.fn()}
        submitting={false}
      />,
    );

    const standard = (await screen.findByText(/standard rate/i)).parentElement as HTMLElement;
    expect(within(standard).getByText(/₱/)).toHaveTextContent('₱60,000.00');
  });
});
