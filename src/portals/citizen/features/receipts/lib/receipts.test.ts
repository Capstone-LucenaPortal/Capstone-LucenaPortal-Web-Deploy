import { describe, it, expect } from 'vitest';
import type { AcknowledgementReceipt } from '@/portals/citizen/features/receipts/types';
import {
  receiptService,
  receiptSealUrl,
  receiptServiceLabel,
  receiptReferences,
} from '@/portals/citizen/features/receipts/lib/receipts';

function makeReceipt(overrides: Partial<AcknowledgementReceipt> = {}): AcknowledgementReceipt {
  return {
    id: 'r1',
    service: 'yellow_card',
    yellow_card_application_id: 'yc1',
    incident_id: null,
    booking_id: null,
    reference_number: 'YC-2026-000091',
    received_at: '2026-09-22T08:05:00+00:00',
    received_at_manila: 'September 22, 2026, 4:05 PM',
    officer_full_name: 'To be nominated',
    officer_unit: 'Pending nomination (SCRUM-105)',
    officer_designation: 'Officer of Record',
    officer_is_placeholder: true,
    agency_name: 'City Government of Lucena',
    seal_path: 'agency/seal.png',
    issued_at: '2026-09-22T08:05:00+00:00',
    ...overrides,
  };
}

describe('receiptServiceLabel', () => {
  it('names a Yellow Card application', () => {
    expect(receiptServiceLabel('yellow_card')).toBe('Yellow Card Application');
  });

  // Guards the plural enum label. A singular 'incident' matches nothing on the
  // database side, and would silently fall through to the generic label.
  it('names an incident report from the plural enum label', () => {
    expect(receiptServiceLabel('incidents')).toBe('Incident Report');
  });

  it('names a booking', () => {
    expect(receiptServiceLabel('booking')).toBe('Venue Booking');
  });

  it('falls back to a neutral label for a service with no receipt copy', () => {
    expect(receiptServiceLabel('platform')).toBe('Submission');
  });
});

describe('receiptReferences', () => {
  it('collects the reference numbers that have a receipt', () => {
    const refs = receiptReferences([
      makeReceipt({ reference_number: 'YC-2026-000091' }),
      makeReceipt({ reference_number: 'INC-2026-000012', service: 'incidents' }),
    ]);
    expect(refs.has('YC-2026-000091')).toBe(true);
    expect(refs.has('INC-2026-000012')).toBe(true);
  });

  // A submission from before `l66` has no receipt by design (DB ADR 0001), so
  // the dashboard must be able to tell "no receipt" from "receipt exists".
  it('does not claim a reference it was never given', () => {
    const refs = receiptReferences([makeReceipt({ reference_number: 'YC-2026-000091' })]);
    expect(refs.has('BK-2026-000003')).toBe(false);
  });

  it('is empty for a citizen with no receipts', () => {
    expect(receiptReferences([]).size).toBe(0);
  });
});

describe('mock mode', () => {
  it('getMine returns [] rather than fabricating rows', async () => {
    await expect(receiptService.getMine()).resolves.toEqual([]);
  });

  it('getByReference returns null rather than fabricating a receipt', async () => {
    await expect(receiptService.getByReference('YC-2026-000091')).resolves.toBeNull();
  });

  it('receiptSealUrl returns null with no backend configured', () => {
    expect(receiptSealUrl('agency/seal.png')).toBeNull();
  });

  it('receiptSealUrl returns null when the receipt names no seal', () => {
    expect(receiptSealUrl(null)).toBeNull();
  });
});
