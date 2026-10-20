import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import type { PublicEvent } from '@/portals/citizen/features/content/types';
import { contentService, formatEventWhen, groupEventsByMonth, isUpcomingEvent, siteContentUrl } from '@/portals/citizen/features/content/lib/content';

function makeEvent(overrides: Partial<PublicEvent> = {}): PublicEvent {
  return {
    id: 'e1',
    title: 'Test Event',
    description: null,
    location_text: null,
    category_code: null,
    category_label: null,
    color_hex: null,
    start_at: '2026-09-10T02:00:00+00:00',
    end_at: null,
    image_path: null,
    ...overrides,
  };
}

describe('isUpcomingEvent', () => {
  const now = new Date('2026-09-01T00:00:00Z');

  it('keeps an event that has not started', () => {
    expect(isUpcomingEvent(makeEvent(), now)).toBe(true);
  });

  it('drops a single-moment event once it has passed', () => {
    const past = makeEvent({ start_at: '2026-08-20T02:00:00+00:00' });
    expect(isUpcomingEvent(past, now)).toBe(false);
  });

  it('keeps a multi-day event that started but has not ended', () => {
    const running = makeEvent({
      start_at: '2026-08-28T02:00:00+00:00',
      end_at: '2026-09-05T02:00:00+00:00',
    });
    expect(isUpcomingEvent(running, now)).toBe(true);
  });

  it('drops a row whose timestamp will not parse rather than throwing', () => {
    expect(isUpcomingEvent(makeEvent({ start_at: 'not-a-date' }), now)).toBe(false);
  });
});

describe('groupEventsByMonth', () => {
  it('buckets consecutive events of the same month together, in order', () => {
    const groups = groupEventsByMonth([
      makeEvent({ id: 'a', start_at: '2026-09-02T02:00:00+00:00' }),
      makeEvent({ id: 'b', start_at: '2026-09-20T02:00:00+00:00' }),
      makeEvent({ id: 'c', start_at: '2026-10-01T02:00:00+00:00' }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['2026-09', '2026-10']);
    expect(groups[0].events.map((e) => e.id)).toEqual(['a', 'b']);
    expect(groups[1].events.map((e) => e.id)).toEqual(['c']);
  });

  it('zero-pads the month so keys sort lexically', () => {
    const groups = groupEventsByMonth([makeEvent({ start_at: '2026-03-04T02:00:00+00:00' })]);
    expect(groups[0].key).toBe('2026-03');
  });

  it('skips unparseable rows instead of crashing the page', () => {
    const groups = groupEventsByMonth([
      makeEvent({ id: 'bad', start_at: '' }),
      makeEvent({ id: 'good' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].events.map((e) => e.id)).toEqual(['good']);
  });

  it('returns [] for no events', () => {
    expect(groupEventsByMonth([])).toEqual([]);
  });
});

describe('formatEventWhen', () => {
  it('returns an empty string for an unparseable start', () => {
    expect(formatEventWhen(makeEvent({ start_at: 'nope' }))).toBe('');
  });
});

// A hosted server runs in UTC and a visitor's browser can be anywhere, so the
// process zone is forced to UTC: a calendar read from host-local getters fails
// here even on a developer machine already on Manila time (SCRUM-241).
describe('in Manila time, whatever the process zone', () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'UTC';
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('UTC');
  });

  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it("files an event early on the 1st under Manila's month, not UTC's", () => {
    // 01:00 on Sep 1 in Manila is still Aug 31 in UTC.
    const groups = groupEventsByMonth([makeEvent({ start_at: '2026-08-31T17:00:00+00:00' })]);
    expect(groups[0].key).toBe('2026-09');
    expect(groups[0].label).toBe('September 2026');
  });

  it('omits the time for an all-day row stored at Manila midnight', () => {
    expect(formatEventWhen(makeEvent({ start_at: '2026-09-10T00:00:00+08:00' }))).toBe(
      'Thu, Sep 10, 2026',
    );
  });

  it('keeps the time for a row at UTC midnight, which is 8 AM in Manila', () => {
    expect(formatEventWhen(makeEvent({ start_at: '2026-09-10T00:00:00Z' }))).toBe(
      'Thu, Sep 10, 2026, 8:00 AM',
    );
  });

  it("renders a range on Manila's clock", () => {
    const text = formatEventWhen(
      makeEvent({ start_at: '2026-09-10T06:00:00+08:00', end_at: '2026-09-10T09:00:00+08:00' }),
    );
    expect(text).toBe('Thu, Sep 10, 2026, 6:00 AM – 9:00 AM');
  });
});

describe('mock mode', () => {
  it('getEvents returns [] rather than fabricating rows', async () => {
    await expect(contentService.getEvents()).resolves.toEqual([]);
  });

  it('siteContentUrl returns null with no backend configured', () => {
    expect(siteContentUrl('events/poster.jpg')).toBeNull();
  });

  it('siteContentUrl returns null for a row with no image', () => {
    expect(siteContentUrl(null)).toBeNull();
  });
});
