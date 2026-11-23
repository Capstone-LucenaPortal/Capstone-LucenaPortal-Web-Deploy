import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LCCStep3Scheduling from '@/portals/citizen/features/booking/components/steps/lcc-step-3-scheduling';
import { EMPTY_BOOKING_FORM, toDateStr } from '@/portals/citizen/features/booking/lib/schedule';
import type { BookingFormData } from '@/portals/citizen/features/booking/types';
import { bookingService } from '@/portals/citizen/features/booking/lib/booking';
import { catalogService } from '@/portals/citizen/lib/supabase/catalogs';

const BASE_CONFIG = {
  downpayment_pct: 50,
  payment_window_hours: 48,
  min_duration_hours: 6,
  opening_hour: 6,
  closing_hour: 22,
  balance_due_days_before_event: 7,
};

beforeEach(() => {
  vi.spyOn(bookingService, 'getVenueAvailability').mockResolvedValue([]);
  vi.spyOn(catalogService, 'getBookingConfig').mockResolvedValue({ ...BASE_CONFIG, changeover_hours: 1 });
});

afterEach(() => {
  vi.restoreAllMocks();
});


function tomorrowAt(hour: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return `${toDateStr(d)} ${String(hour).padStart(2, '0')}:00:00+08`;
}

/**
 * A Space's Occupancy tomorrow, its Event and blocked end in Manila hours, as
 * the availability view lists it under one Venue that uses that Space.
 */
function occupancy(startHour: number, eventEnd: number, blockedEnd: number, venueCode = 'atrium', spaceCode = 'atrium') {
  const day = tomorrowAt(0).slice(0, 10);
  return {
    venue_code: venueCode,
    space_code: spaceCode,
    event_date: day,
    during: `["${tomorrowAt(startHour)}","${tomorrowAt(eventEnd)}")`,
    blocked: `["${tomorrowAt(startHour)}","${tomorrowAt(blockedEnd)}")`,
  };
}

/** Step 3 is controlled by the wizard; this stands in for it, holding the form. */
function Harness({ venueCode = 'atrium' }: { venueCode?: string }) {
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [data, setData] = useState<BookingFormData>({
    ...EMPTY_BOOKING_FORM,
    venueCode,
    venueLabel: venueCode,
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

async function renderStep(venueCode?: string) {
  render(<Harness venueCode={venueCode} />);
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


/** SCRUM-261: the Changeover after every Event. */
describe('LCCStep3Scheduling and the Changeover', () => {
  it('explains the Changeover above the start time', async () => {
    vi.spyOn(catalogService, 'getBookingConfig').mockResolvedValue({ ...BASE_CONFIG, changeover_hours: 2 });
    await renderStep();
    expect(
      screen.getByText('Events need 2 hour(s) between them for the venue to be reset.'),
    ).toBeInTheDocument();
  });

  it('hides the explanation when there is no Changeover', async () => {
    vi.spyOn(catalogService, 'getBookingConfig').mockResolvedValue({ ...BASE_CONFIG, changeover_hours: 0 });
    await renderStep();
    expect(screen.queryByText(/between them for the venue to be reset/)).not.toBeInTheDocument();
  });

  it('uses a Changeover of 1 in mock mode, with no booking settings to read', async () => {
    vi.spyOn(catalogService, 'getBookingConfig').mockResolvedValue(null);
    await renderStep();
    expect(
      screen.getByText('Events need 1 hour(s) between them for the venue to be reset.'),
    ).toBeInTheDocument();
  });

  it("refuses a start inside another Event's Changeover, and says why", async () => {
    // 06:00–12:00, its Changeover to 13:00.
    vi.spyOn(bookingService, 'getVenueAvailability').mockResolvedValue([occupancy(6, 12, 13)]);
    const start = await renderStep();
    fireEvent.change(start, { target: { value: '12:00' } });

    expect(
      screen.getByText(/This time is too close to another event\. The LCC needs 1 hour\(s\) between events to reset the venue\./),
    ).toBeInTheDocument();
    expect(review()).toBeDisabled();

    fireEvent.change(start, { target: { value: '13:00' } });
    expect(screen.queryByText(/too close to another event/)).not.toBeInTheDocument();
    expect(review()).toBeEnabled();
  });

  it("refuses a time whose own Changeover would reach a later Event", async () => {
    // A later Event from 20:00. 13:00–19:00 plus 1 hour runs into it.
    vi.spyOn(bookingService, 'getVenueAvailability').mockResolvedValue([occupancy(20, 22, 23)]);
    const start = await renderStep();
    fireEvent.change(start, { target: { value: '14:00' } });

    expect(screen.getByText(/too close to another event/)).toBeInTheDocument();
    expect(review()).toBeDisabled();
  });

  it("falls back to the overlap wording when there is no Changeover", async () => {
    vi.spyOn(catalogService, 'getBookingConfig').mockResolvedValue({ ...BASE_CONFIG, changeover_hours: 0 });
    vi.spyOn(bookingService, 'getVenueAvailability').mockResolvedValue([occupancy(6, 12, 12)]);
    const start = await renderStep();
    fireEvent.change(start, { target: { value: '10:00' } });

    expect(screen.getByText(/overlaps an existing booking/)).toBeInTheDocument();
    expect(screen.queryByText(/too close to another event/)).not.toBeInTheDocument();
    expect(review()).toBeDisabled();
  });

  // The view lists a Space's Occupancy under every Venue that uses the Space:
  // the Atrium's under atrium and full_facility, the Arena's under
  // sports_arena, full_facility and rehearsal_practice.
  it.each([
    ['Full Facility', 'an Atrium-only', 'full_facility', 'atrium', ['atrium', 'full_facility']],
    ['Full Facility', 'an Arena-only', 'full_facility', 'arena', ['sports_arena', 'full_facility', 'rehearsal_practice']],
    ['Rehearsal', 'the Arena', 'rehearsal_practice', 'arena', ['sports_arena', 'full_facility', 'rehearsal_practice']],
  ])('blocks %s with %s Changeover', async (_venue, _space, venueCode, spaceCode, listedUnder) => {
    vi.spyOn(bookingService, 'getVenueAvailability').mockResolvedValue(
      (listedUnder as string[]).map((v) => occupancy(6, 12, 13, v, spaceCode as string)),
    );
    const start = await renderStep(venueCode as string);
    fireEvent.change(start, { target: { value: '12:00' } });

    expect(screen.getByText(/too close to another event/)).toBeInTheDocument();
    expect(review()).toBeDisabled();
  });
});
