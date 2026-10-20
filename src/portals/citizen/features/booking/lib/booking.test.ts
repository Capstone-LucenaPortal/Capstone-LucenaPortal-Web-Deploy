import { describe, it, expect, vi } from 'vitest';
import {
  getMyBookings,
  bookingService,
  cancelBooking,
  translateBookingError,
  translateCancelError,
  BookingSubmitError,
} from '@/portals/citizen/features/booking/lib/booking';
import * as supabaseClientModule from '@/portals/citizen/lib/supabase/client';

// The vitest environment for this project is 'node', which has no `localStorage` global.
// requestService.addRequest() (invoked by submitBooking's mock-mode branch) calls
// localStorage.setItem directly, so a minimal in-memory polyfill is installed here to let
// that code path run under test without modifying requestService.ts.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
}

describe('getMyBookings in mock mode (no backend)', () => {
  it('resolves [] when no backend is configured', async () => {
    expect(await getMyBookings()).toEqual([]);
  });
});

describe('bookingService.getVenueAvailability in mock mode (no backend)', () => {
  it('resolves [] when no backend is configured', async () => {
    expect(await bookingService.getVenueAvailability()).toEqual([]);
  });
});

const MOCK_BOOKING_FIELDS = {
  classificationCode: 'commercial',
  eventTitle: 'Annual Conference',
  eventTypeCode: 'conference',
  estimatedHeadcount: 200,
  contactPerson: 'Juan Dela Cruz',
  contactNumber: '09171234567',
  emailAddress: 'juan@example.com',
  venueCode: 'atrium',
  eventDate: '2026-12-01',
  startTime: '08:00',
  durationHours: 6,
};

describe('bookingService.submitBooking in mock mode (no backend)', () => {
  it('resolves a fake reference number and does not throw', async () => {
    const result = await bookingService.submitBooking({ ...MOCK_BOOKING_FIELDS });
    expect(result.reference_number).toMatch(/^BK-\d{4}-\d{6}$/);
    expect(result.id).toBeTruthy();
  });

  it('reports the commercial tier for a commercial classification', async () => {
    const result = await bookingService.submitBooking({
      ...MOCK_BOOKING_FIELDS,
      classificationCode: 'commercial',
    });
    expect(result.rate_tier).toBe('commercial');
  });

  // Proves the mock's guess actually responds to its input rather than
  // returning a constant.
  it('reports the discounted tier for a discount-eligible classification', async () => {
    const result = await bookingService.submitBooking({
      ...MOCK_BOOKING_FIELDS,
      classificationCode: 'government',
    });
    expect(result.rate_tier).toBe('discounted');
  });

  // Mirrors bk_on_submit since l77b: a discounted booking waits in `pending`
  // for its organisation document, and is never handed a payment screen.
  it('parks a discounted booking in pending, and a commercial one in awaiting_payment', async () => {
    const discounted = await bookingService.submitBooking({ ...MOCK_BOOKING_FIELDS, classificationCode: 'government' });
    expect(discounted.status).toBe('pending');
    const commercial = await bookingService.submitBooking({ ...MOCK_BOOKING_FIELDS, classificationCode: 'commercial' });
    expect(commercial.status).toBe('awaiting_payment');
  });
});

describe('bookingService.giveUpTierClaim', () => {
  it('returns a commercial booking awaiting payment in mock mode', async () => {
    const result = await bookingService.giveUpTierClaim('mock-booking-id');
    expect(result).toMatchObject({ id: 'mock-booking-id', rate_tier: 'commercial', status: 'awaiting_payment' });
  });

  it('calls give_up_tier_claim with the booking id and returns the repriced row', async () => {
    const row = {
      id: 'bk-1',
      reference_number: 'BK-2026-000040',
      status: 'awaiting_payment',
      rate_tier: 'commercial',
      total_fee: 60000,
      downpayment_amount: 30000,
    };
    const rpc = vi.fn().mockResolvedValue({ data: row, error: null });
    const spy = vi
      .spyOn(supabaseClientModule, 'getSupabaseClient')
      .mockReturnValue({ rpc } as unknown as ReturnType<typeof supabaseClientModule.getSupabaseClient>);
    try {
      await expect(bookingService.giveUpTierClaim('bk-1')).resolves.toEqual(row);
      expect(rpc).toHaveBeenCalledWith('give_up_tier_claim', { p_booking_id: 'bk-1' });
    } finally {
      spy.mockRestore();
    }
  });

  it('turns a refusal into citizen copy, without the raw message', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'give_up_tier_claim: BK-2026-000040 is awaiting_tier_review; ...' },
    });
    const spy = vi
      .spyOn(supabaseClientModule, 'getSupabaseClient')
      .mockReturnValue({ rpc } as unknown as ReturnType<typeof supabaseClientModule.getSupabaseClient>);
    try {
      await expect(bookingService.giveUpTierClaim('bk-1')).rejects.toThrow(
        /can no longer continue without the discount/i,
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe('bookingService.submitDownpayment in mock mode (no backend)', () => {
  it('resolves a fake payment id', async () => {
    const result = await bookingService.submitDownpayment('mock-booking-id', 'GCASH-REF-123');
    expect(result.id).toBeTruthy();
  });
});

describe('bookingService.uploadBookingDocument in mock mode (no backend)', () => {
  it('resolves without throwing', async () => {
    const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
    await expect(
      bookingService.uploadBookingDocument('mock-booking-id', 'gcash_receipt', file, 'mock-payment-id'),
    ).resolves.toBeUndefined();
  });
});

/**
 * submitBooking only validates on the live path (mock mode is a client-side
 * fake with no server to protect), so these tests install a fake Supabase
 * client (pattern copied from authService.test.ts's logout-failure test) and
 * assert the RPC is never reached when the fields are bad.
 */
describe('bookingService.submitBooking field validation (live path)', () => {
  function withFakeClient() {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'x', reference_number: 'BK-2026-000001' }, error: null });
    const fakeClient = { rpc } as unknown as ReturnType<typeof supabaseClientModule.getSupabaseClient>;
    const spy = vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(fakeClient);
    return { rpc, spy };
  }

  it('rejects an oversize event title without calling the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await expect(
        bookingService.submitBooking({ ...MOCK_BOOKING_FIELDS, eventTitle: 'a'.repeat(121) }),
      ).rejects.toThrow(BookingSubmitError);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects a NaN headcount without calling the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await expect(
        bookingService.submitBooking({ ...MOCK_BOOKING_FIELDS, estimatedHeadcount: NaN }),
      ).rejects.toThrow(BookingSubmitError);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects a bad email address without calling the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await expect(
        bookingService.submitBooking({ ...MOCK_BOOKING_FIELDS, emailAddress: 'not-an-email' }),
      ).rejects.toThrow(BookingSubmitError);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects a malformed mobile number without calling the RPC', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await expect(
        bookingService.submitBooking({ ...MOCK_BOOKING_FIELDS, contactNumber: '12345' }),
      ).rejects.toThrow(BookingSubmitError);
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('accepts valid fields and sends coerced integers for headcount/duration', async () => {
    const { rpc, spy } = withFakeClient();
    try {
      await bookingService.submitBooking({ ...MOCK_BOOKING_FIELDS });
      expect(rpc).toHaveBeenCalledWith(
        'submit_booking',
        expect.objectContaining({ p_estimated_headcount: 200, p_duration_hours: 6 }),
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe('translateBookingError', () => {
  it('translates payment errors without leaking internals', () => {
    expect(translateBookingError('function submit_downpayment(uuid) does not exist')).not.toMatch(/submit_downpayment/);
  });

  it('translates upload/storage errors into citizen-facing guidance', () => {
    const msg = translateBookingError('storage/object-too-large: mime type not allowed');
    expect(msg).toMatch(/JPG|PNG|PDF/);
    expect(msg).not.toMatch(/storage\/object/);
  });

  it('translates gcash/downpayment errors into citizen-facing guidance', () => {
    // The payment stage is what makes this a reference-number problem; the same
    // uncoded text at submit stage is a generic submit failure.
    const msg = translateBookingError('invalid gcash reference format', undefined, 'payment');
    expect(msg).toMatch(/reference number/i);
  });

  // Codes are stable; message text is written for developers and drifts. These
  // four used to collapse into one wrong sentence under substring matching.
  it('distinguishes a slot clash from a generic failure', () => {
    const msg = translateBookingError('conflicting key value violates exclusion constraint', '23P01');
    expect(msg).toMatch(/no longer available/i);
    expect(msg).not.toMatch(/reference number/i);
    expect(msg).not.toMatch(/exclusion constraint/i);
  });

  it('reports a deactivated catalog option as such, not as a payment problem', () => {
    const msg = translateBookingError('insert or update violates foreign key constraint', '23503');
    expect(msg).toMatch(/no longer available/i);
    expect(msg).not.toMatch(/reference number/i);
  });

  it('reports a closed payment window distinctly from a slot clash', () => {
    const msg = translateBookingError('booking is not awaiting payment', '42501', 'payment');
    expect(msg).toMatch(/payment window|not accepting payment/i);
    expect(msg).not.toMatch(/choose another/i);
  });

  it('reports a not-yet-quoted booking distinctly at the payment stage', () => {
    const msg = translateBookingError('booking has no quote', '22023', 'payment');
    expect(msg).toMatch(/not been quoted/i);
  });

  it('reports a duplicate payment as already on file', () => {
    const msg = translateBookingError('duplicate key value violates unique constraint', '23505', 'payment');
    expect(msg).toMatch(/already on file/i);
  });

  it('never leaks raw Postgres text for any code it handles', () => {
    for (const code of ['23P01', '23503', '42501', '22023', '23505', '23514', 'P0002']) {
      const msg = translateBookingError('violates constraint bk_occupancy_excl on table bookings', code);
      expect(msg).not.toMatch(/constraint|bookings|violates/i);
    }
  });
});

describe('translateBookingError at the skip stage', () => {
  it('explains a closed hold or a claim already submitted', () => {
    expect(translateBookingError('raw', '42501', 'skip')).toMatch(/can no longer continue without the discount/i);
  });

  it('reports a missing booking for the not-found code new RPCs raise', () => {
    expect(translateBookingError('raw', 'PT404', 'skip')).toBe('We could not find that booking.');
  });
});

describe('translateCancelError', () => {
  it('sends a citizen with money on file to City Hall, not back to a retry', () => {
    const msg = translateCancelError('42501', 'confirmed');
    expect(msg).toMatch(/City Hall/i);
    expect(msg).toMatch(/payment is already on file/i);
  });

  it('uses the same money-on-file copy for payment_verification', () => {
    expect(translateCancelError('42501', 'payment_verification')).toMatch(/City Hall/i);
  });

  it('reports a terminal booking as already closed, not as a refund matter', () => {
    const msg = translateCancelError('42501', 'cancelled');
    expect(msg).toMatch(/already closed/i);
    expect(msg).not.toMatch(/refund/i);
  });

  it('asks for a reason on a blank-reason refusal', () => {
    expect(translateCancelError('22023')).toMatch(/why you are cancelling/i);
  });
});

describe('cancelBooking', () => {
  it('rejects a blank reason before reaching the network', async () => {
    await expect(cancelBooking('booking-1', '   ')).rejects.toThrow(/why you are cancelling/i);
  });

  it('is a no-op in mock mode', async () => {
    await expect(cancelBooking('booking-1', 'Event postponed.')).resolves.toBeUndefined();
  });
});
