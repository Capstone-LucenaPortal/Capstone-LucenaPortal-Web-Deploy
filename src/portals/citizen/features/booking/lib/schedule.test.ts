import { describe, it, expect } from 'vitest';
import {
  parseDuringRange,
  occupancyHours,
  computeDayStatus,
  hasTimeConflict,
  estimateVenueFee,
  nextStageAfterSubmit,
  estimateDownpayment,
  formatClockTime,
} from '@/portals/citizen/features/booking/lib/schedule';

describe('parseDuringRange', () => {
  it('parses a quoted tstzrange literal as returned by PostgREST', () => {
    const result = parseDuringRange('["2026-12-01 08:00:00+00","2026-12-01 14:00:00+00")');
    expect(result).not.toBeNull();
    expect(result!.start.toISOString()).toBe('2026-12-01T08:00:00.000Z');
    expect(result!.end.toISOString()).toBe('2026-12-01T14:00:00.000Z');
  });

  it('parses an unquoted range literal', () => {
    const result = parseDuringRange('[2026-01-05 06:00:00+00,2026-01-05 09:00:00+00)');
    expect(result).not.toBeNull();
    expect(result!.start.toISOString()).toBe('2026-01-05T06:00:00.000Z');
  });

  it('returns null for malformed input', () => {
    expect(parseDuringRange('not-a-range')).toBeNull();
  });
});

describe('occupancyHours', () => {
  // SCRUM-261 (DB l117): public_venue_availability gives each Occupancy's
  // `blocked` range, its Event plus the Changeover that Booking recorded.
  it('runs an Occupancy from its Event start to its blocked end, in Manila hours', () => {
    const row = {
      during: '["2026-12-01 00:00:00+00","2026-12-01 06:00:00+00")',
      blocked: '["2026-12-01 00:00:00+00","2026-12-01 07:00:00+00")',
    };
    expect(occupancyHours(row)).toEqual({ startHour: 8, endHour: 15 });
  });

  it("keeps a Changeover that runs past midnight on the Event's own day", () => {
    const row = {
      during: '["2026-12-01 12:00:00+00","2026-12-01 16:00:00+00")',
      blocked: '["2026-12-01 12:00:00+00","2026-12-01 18:00:00+00")',
    };
    expect(occupancyHours(row)).toEqual({ startHour: 20, endHour: 26 });
  });

  it('falls back to the Event range when the view has no blocked column yet', () => {
    const row = { during: '["2026-12-01 00:00:00+00","2026-12-01 06:00:00+00")' };
    expect(occupancyHours(row)).toEqual({ startHour: 8, endHour: 14 });
  });

  it('returns null for a malformed range', () => {
    expect(occupancyHours({ during: 'garbage', blocked: 'garbage' })).toBeNull();
  });
});

describe('computeDayStatus', () => {
  // Opening 06:00, closing 22:00, a 6-hour minimum and a 1-hour Changeover.
  const dayHours = { openingHour: 6, closingHour: 22, minDurationHours: 6, changeoverHours: 1 };

  it('is available with no occupied ranges', () => {
    expect(computeDayStatus([], dayHours)).toBe('available');
  });

  it('is partial while a minimum-length Event still fits after a Changeover', () => {
    // 08:00–14:00 blocks to 15:00; 15:00–21:00 still fits.
    expect(computeDayStatus([{ startHour: 8, endHour: 15 }], dayHours)).toBe('partial');
  });

  // SCRUM-261: this replaces "booked hours >= open hours". Seven of sixteen
  // hours are held, yet no six-hour Event fits on either side.
  it('is full when nothing fits the minimum duration once Changeovers are counted', () => {
    expect(computeDayStatus([{ startHour: 10, endHour: 17 }], dayHours)).toBe('fully-booked');
  });

  it('lets the last Event end exactly at closing, its Changeover running past', () => {
    // 06:00–12:00 blocks to 13:00; 16:00–22:00 fits though its Changeover ends at 23:00.
    expect(computeDayStatus([{ startHour: 6, endHour: 13 }], { ...dayHours, minDurationHours: 9 })).toBe('partial');
  });

  it('is full when the whole window is held', () => {
    expect(computeDayStatus([{ startHour: 6, endHour: 23 }], dayHours)).toBe('fully-booked');
  });

  it('counts the Changeover the new Event would need before a later one', () => {
    // 15:00 onwards held: 06:00–14:00 plus its Changeover to 15:00 fits; with a
    // 2-hour Changeover it would have to start at 05:00, before opening.
    const held = [{ startHour: 15, endHour: 23 }];
    expect(computeDayStatus(held, { ...dayHours, minDurationHours: 8, changeoverHours: 1 })).toBe('partial');
    expect(computeDayStatus(held, { ...dayHours, minDurationHours: 8, changeoverHours: 2 })).toBe('fully-booked');
  });
});

describe('hasTimeConflict', () => {
  it('detects an overlap', () => {
    expect(hasTimeConflict([{ startHour: 8, endHour: 12 }], 10, 4)).toBe(true);
  });

  it('reports no conflict for a non-intersecting range', () => {
    expect(hasTimeConflict([{ startHour: 8, endHour: 12 }], 13, 2)).toBe(false);
  });

  // SCRUM-261: each existing Occupancy already runs to its blocked end; the
  // proposed Booking holds the Space for its Event plus the current Changeover.
  describe('with a Changeover', () => {
    // An 08:00–14:00 Event whose 1-hour Changeover runs to 15:00.
    const existing = [{ startHour: 8, endHour: 15 }];

    it("refuses a start inside another Event's Changeover", () => {
      expect(hasTimeConflict(existing, 14, 4, 1)).toBe(true);
    });

    it("allows a start exactly at a Changeover's end", () => {
      expect(hasTimeConflict(existing, 15, 4, 1)).toBe(false);
    });

    it("refuses a time whose own Changeover would run into a later Event", () => {
      // 16:00–20:00, then a 1-hour Changeover to 21:00, against an Event at 20:00.
      expect(hasTimeConflict([{ startHour: 20, endHour: 23 }], 16, 4, 1)).toBe(true);
    });

    it('allows a time whose own Changeover ends exactly as a later Event starts', () => {
      expect(hasTimeConflict([{ startHour: 21, endHour: 23 }], 16, 4, 1)).toBe(false);
    });

    it('with no Changeover, lets an Event end exactly as the next one starts', () => {
      expect(hasTimeConflict([{ startHour: 20, endHour: 23 }], 16, 4, 0)).toBe(false);
    });
  });
});

describe('estimateVenueFee', () => {
  it('estimates a standard venue fee with extension hours beyond the 6-hour base', () => {
    const rate = { base_fee: 30000, extension_hourly: 5400, hourly_rate: null, requires_quote: false };
    expect(estimateVenueFee(rate, 8)).toEqual({ amount: 30000 + 2 * 5400, requiresQuote: false });
  });

  it('estimates an hourly venue fee with no base/extension split', () => {
    const rate = { base_fee: null, extension_hourly: null, hourly_rate: 1500, requires_quote: false };
    expect(estimateVenueFee(rate, 3)).toEqual({ amount: 4500, requiresQuote: false });
  });

  it('flags requires_quote instead of returning an amount', () => {
    const rate = { base_fee: null, extension_hourly: null, hourly_rate: null, requires_quote: true };
    expect(estimateVenueFee(rate, 6)).toEqual({ amount: null, requiresQuote: true });
  });

  it('returns a null amount when no matching rate row was found', () => {
    expect(estimateVenueFee(undefined, 6)).toEqual({ amount: null, requiresQuote: false });
  });
});

describe('nextStageAfterSubmit', () => {
  // SCRUM-198 (DB l77b): the server's status says whose turn it is, so the
  // wizard follows the status. bk_on_submit parks every discounted booking in
  // `pending` until its organisation document is uploaded, Full Facility
  // included, so no tier check is needed to catch the quote branch.
  it('sends a booking waiting for its organisation document to the upload step', () => {
    expect(nextStageAfterSubmit('pending')).toBe('org-document');
  });

  it('sends a booking in Tier Review to the review wait, never to payment', () => {
    expect(nextStageAfterSubmit('awaiting_tier_review')).toBe('tier-review');
  });

  it('sends a booking awaiting a quote to the quote screen', () => {
    expect(nextStageAfterSubmit('awaiting_quote')).toBe('quote');
  });

  // The standard tier, and a skipped claim repriced at commercial: both come
  // back from the server as awaiting_payment.
  it('sends a booking awaiting payment to payment', () => {
    expect(nextStageAfterSubmit('awaiting_payment')).toBe('payment');
  });
});

describe('estimateDownpayment', () => {
  it('takes the configured percentage of the fee', () => {
    expect(estimateDownpayment({ amount: 60000, requiresQuote: false }, 50)).toEqual({
      amount: 30000,
      requiresQuote: false,
    });
  });

  // booking_money(): round(total * pct / 100, 2).
  it('rounds to the centavo as booking_money does', () => {
    expect(estimateDownpayment({ amount: 1000.01, requiresQuote: false }, 33)).toEqual({
      amount: 330,
      requiresQuote: false,
    });
    expect(estimateDownpayment({ amount: 1234.5, requiresQuote: false }, 50).amount).toBe(617.25);
  });

  it('carries a quote through with no amount', () => {
    expect(estimateDownpayment({ amount: null, requiresQuote: true }, 50)).toEqual({
      amount: null,
      requiresQuote: true,
    });
  });
});

describe('estimateVenueFee with l55 rehearsal rates', () => {
  // Since l55, hourly_rate is NULL on both rehearsal_practice venue-rate rows
  // and the real figure lives in public_booking_rehearsal_rates, keyed on the
  // selected rate type and independent of rate_tier.
  const rehearsalVenueRate = {
    base_fee: null,
    extension_hourly: null,
    hourly_rate: null,
    requires_quote: false,
  };

  it('prices a rehearsal booking from the rehearsal rate, not the nulled column', () => {
    expect(estimateVenueFee(rehearsalVenueRate, 3, 1200)).toEqual({
      amount: 3600,
      requiresQuote: false,
    });
  });

  it('is the regression this fixes: no rehearsal rate means no figure at all', () => {
    // The pre-l55 code path. Step 4 rendered an em dash here while still asking
    // the citizen to accept terms on the undisplayed amount.
    expect(estimateVenueFee(rehearsalVenueRate, 3)).toEqual({
      amount: null,
      requiresQuote: false,
    });
  });

  it('applies the same rehearsal rate whatever the tier, since rates are tier-independent', () => {
    const commercial = estimateVenueFee(rehearsalVenueRate, 4, 1800);
    const discounted = estimateVenueFee(rehearsalVenueRate, 4, 1800);
    expect(commercial.amount).toBe(7200);
    expect(discounted.amount).toBe(commercial.amount);
  });

  it('lets the rehearsal rate win over a venue hourly_rate, if one is ever restored', () => {
    const withBoth = { ...rehearsalVenueRate, hourly_rate: 999 };
    expect(estimateVenueFee(withBoth, 2, 1200).amount).toBe(2400);
  });

  it('still short-circuits on requires_quote before pricing anything', () => {
    const quoted = { ...rehearsalVenueRate, requires_quote: true };
    expect(estimateVenueFee(quoted, 5, 15000)).toEqual({ amount: null, requiresQuote: true });
  });

  it('leaves standard base_fee venues untouched by the new parameter', () => {
    const standard = { base_fee: 20000, extension_hourly: 2000, hourly_rate: null, requires_quote: false };
    // 6 included hours + 2 extension hours.
    expect(estimateVenueFee(standard, 8).amount).toBe(24000);
  });
});

describe('formatClockTime', () => {
  it('renders a Postgres time the way the booking wizard renders an hour', () => {
    // SCRUM-188: the dashboard printed the raw column, "08:00:00".
    expect(formatClockTime('08:00:00')).toBe('8:00 AM');
    expect(formatClockTime('13:00:00')).toBe('1:00 PM');
    expect(formatClockTime('00:00:00')).toBe('12:00 AM');
  });

  it('keeps the minutes, and accepts a time without seconds', () => {
    expect(formatClockTime('09:30')).toBe('9:30 AM');
  });

  it('passes anything unparseable through rather than printing NaN', () => {
    expect(formatClockTime('')).toBe('');
    expect(formatClockTime('soon')).toBe('soon');
  });
});
