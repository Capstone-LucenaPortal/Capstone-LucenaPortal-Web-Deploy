import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LCCStep3Scheduling from '@/portals/citizen/features/booking/components/steps/lcc-step-3-scheduling';
import { EMPTY_BOOKING_FORM } from '@/portals/citizen/features/booking/lib/schedule';
import type { BookingFormData } from '@/portals/citizen/features/booking/types';
import { bookingService } from '@/portals/citizen/features/booking/lib/booking';
import { catalogService } from '@/portals/citizen/lib/supabase/catalogs';

beforeEach(() => {
  vi.spyOn(bookingService, 'getVenueAvailability').mockResolvedValue([]);
  vi.spyOn(catalogService, 'getBookingConfig').mockResolvedValue({
    downpayment_pct: 50,
    payment_window_hours: 48,
    min_duration_hours: 6,
    opening_hour: 6,
    closing_hour: 22,
    balance_due_days_before_event: 7,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Step 3 is controlled by the wizard; this stands in for it, holding the form. */
function Harness() {
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [data, setData] = useState<BookingFormData>({
    ...EMPTY_BOOKING_FORM,
    venueCode: 'atrium',
    venueLabel: 'Atrium',
    selectedDate: tomorrow,
    durationHours: 6,
  });
  return (
    <LCCStep3Scheduling
      bookingData={data}
      onUpdate={(fields) => setData((d) => ({ ...d, ...fields }))}
      onNext={vi.fn()}
      onBack={vi.fn()}
    />
  );
}

async function renderStep() {
  render(<Harness />);
  return (await screen.findByLabelText('Start Time')) as HTMLSelectElement;
}

const plus = () => fireEvent.click(screen.getByRole('button', { name: '+' }));
const review = () => screen.getByRole('button', { name: /review booking summary/i });

/** #20: a booking must end by the venue's closing hour (22:00 here). */
describe('LCCStep3Scheduling', () => {
  it('clears the start time when a longer duration would end past closing', async () => {
    const start = await renderStep();
    fireEvent.change(start, { target: { value: '15:00' } });
    expect(review()).toBeEnabled();

    plus();
    plus();

    expect(start.value).toBe('');
    expect(screen.queryByText('End Time:')).not.toBeInTheDocument();
    expect(review()).toBeDisabled();
  });

  it('lets the citizen go on once they pick a start that still ends by closing', async () => {
    const start = await renderStep();
    fireEvent.change(start, { target: { value: '15:00' } });
    plus();
    plus();

    fireEvent.change(start, { target: { value: '14:00' } });

    expect(screen.getByText('End Time:').nextElementSibling).toHaveTextContent('10:00 PM');
    expect(review()).toBeEnabled();
  });

  it('keeps the start time when the longer booking still ends by closing', async () => {
    const start = await renderStep();
    fireEvent.change(start, { target: { value: '14:00' } });

    plus();

    expect(start.value).toBe('14:00');
    expect(screen.getByText('End Time:').nextElementSibling).toHaveTextContent('9:00 PM');
    expect(review()).toBeEnabled();
  });
});
