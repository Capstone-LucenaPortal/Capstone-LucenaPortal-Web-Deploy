import { describe, it, expect } from 'vitest';
import type { MyNotification } from '@/portals/citizen/features/notifications/types';
import { notificationService, unreadCount, notificationTarget } from '@/portals/citizen/features/notifications/lib/notifications';

const notification = (overrides: Partial<MyNotification> = {}): MyNotification => ({
  id: 'notif-1',
  module_code: 'booking',
  record_id: 'booking-1',
  event_code: 'quote_issued',
  channel: 'in_app',
  status: 'sent',
  title: 'Your booking has been quoted',
  body: 'Pay the downpayment before the hold expires.',
  created_at: '2026-08-20T02:00:00Z',
  sent_at: '2026-08-20T02:00:00Z',
  read_at: null,
  ...overrides,
});

describe('notificationService in mock mode (no backend)', () => {
  // Read-only methods return [] rather than fabricating rows — a fake
  // notification would deep-link to a record that does not exist.
  it('resolves [] from getMine', async () => {
    expect(await notificationService.getMine()).toEqual([]);
  });

  it('markRead is a silent no-op', async () => {
    await expect(notificationService.markRead('notif-1')).resolves.toBeUndefined();
  });
});

describe('unreadCount', () => {
  it('counts only rows with a null read_at', () => {
    expect(
      unreadCount([
        notification({ id: 'a', read_at: null }),
        notification({ id: 'b', read_at: '2026-08-21T00:00:00Z' }),
        notification({ id: 'c', read_at: null }),
      ]),
    ).toBe(2);
  });

  it('is 0 for an empty inbox', () => {
    expect(unreadCount([])).toBe(0);
  });
});

describe('notificationTarget', () => {
  // The enum label is `incidents`, plural — it does not match the singular used
  // in the RPC names or in my_incidents. Getting this wrong silently produces
  // no deep link rather than an error, so it is asserted explicitly.
  it('maps the plural incidents module code to the incidents section', () => {
    expect(notificationTarget(notification({ module_code: 'incidents', record_id: 'inc-1' }))).toEqual({
      section: 'incidents',
      recordId: 'inc-1',
    });
  });

  it('does not map a singular "incident" — that is not a real enum label', () => {
    expect(notificationTarget(notification({ module_code: 'incident' }))).toBeNull();
  });

  it('maps yellow_card and booking', () => {
    expect(notificationTarget(notification({ module_code: 'yellow_card' }))?.section).toBe('yellowCards');
    expect(notificationTarget(notification({ module_code: 'booking' }))?.section).toBe('bookings');
  });

  it('returns null for platform notifications, which carry no record', () => {
    expect(notificationTarget(notification({ module_code: 'platform', record_id: null }))).toBeNull();
  });

  it('returns null when record_id is absent even for a known module', () => {
    expect(notificationTarget(notification({ module_code: 'booking', record_id: null }))).toBeNull();
  });
});
