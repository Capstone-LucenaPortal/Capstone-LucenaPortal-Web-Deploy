/** Reads the LGU-authored *content* views — events today, posts and places
 * once they carry real rows. Kept out of `catalogService` deliberately: that
 * module caches small reference catalogs that change once a quarter, while
 * this content is edited to be seen the same day. Same env-gated seam and the
 * same "no `is_active` filter" rule — the `public_*` views already drop
 * unpublished rows, so filtering again here would be a second copy of a rule
 * the database owns.
 */

import { getSupabaseClient } from '@/portals/citizen/lib/supabase/client';
import type { PublicEvent, EventMonthGroup, PublicPost, PublicPostCategory } from '../types';
import { MANILA_TIME_ZONE, formatInManila } from '@/shared/dates/manila';

/** Citizen-facing copy for any content read failure. Never interpolate
 * error.message — it's raw PostgREST text naming views and columns. */
const CONTENT_LOAD_ERROR = 'Could not load this page right now. Please try again later.';

/** The one public bucket. Content images are stored as bare paths inside it. */
const SITE_CONTENT_BUCKET = 'site-content';

/** Absolute URL for a `site-content` path, or null when the row has no image.
 * Returns null in mock mode too — there is no client to resolve against. */
export function siteContentUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const client = getSupabaseClient();
  if (!client) return null;
  return client.storage.from(SITE_CONTENT_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** True while an event is still worth showing: it has not finished yet.
 * A multi-day event stays upcoming until `end_at`; a single-moment event
 * (no `end_at`) drops off once `start_at` passes. Pure — `now` is injected. */
export function isUpcomingEvent(event: PublicEvent, now: Date): boolean {
  const ends = new Date(event.end_at ?? event.start_at);
  if (Number.isNaN(ends.getTime())) return false;
  return ends.getTime() >= now.getTime();
}

/** Zero-padded Manila calendar and clock fields of an instant. Events are
 * stored as instants and the city runs on Manila time, so neither the server's
 * UTC nor the visitor's own browser zone may decide which day or hour they
 * fall on. */
function manilaClock(value: Date): { year: string; month: string; hour: string; minute: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const field = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return { year: field('year'), month: field('month'), hour: field('hour'), minute: field('minute') };
}

/** Groups chronologically-sorted events into month buckets, preserving order.
 * Pure. Rows whose `start_at` will not parse are dropped rather than crashing
 * the page — the calendar is read-only content, not a form. */
export function groupEventsByMonth(events: PublicEvent[]): EventMonthGroup[] {
  const groups: EventMonthGroup[] = [];
  for (const event of events) {
    const start = new Date(event.start_at);
    if (Number.isNaN(start.getTime())) continue;
    const { year, month } = manilaClock(start);
    const key = `${year}-${month}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.events.push(event);
      continue;
    }
    groups.push({
      key,
      label: formatInManila(start, { month: 'long', year: 'numeric' }),
      events: [event],
    });
  }
  return groups;
}

/** "Thu, Sep 10, 2026, 6:00 AM – 9:00 AM" in Manila time — the time half is
 * omitted when the row carries no `end_at` and lands exactly on Manila
 * midnight, which is how an all-day event is stored. Pure. */
export function formatEventWhen(event: PublicEvent): string {
  const start = new Date(event.start_at);
  if (Number.isNaN(start.getTime())) return '';
  const date = formatInManila(start, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const { hour, minute } = manilaClock(start);
  const allDay = !event.end_at && hour === '00' && minute === '00';
  if (allDay) return date;

  const time = (value: Date) => formatInManila(value, { hour: 'numeric', minute: '2-digit' });
  const end = event.end_at ? new Date(event.end_at) : null;
  if (!end || Number.isNaN(end.getTime())) return `${date}, ${time(start)}`;
  return `${date}, ${time(start)} – ${time(end)}`;
}

export const contentService = {
  /** Every published event in chronological order. `[]` in mock mode — this is
   * a read, so it fabricates nothing. Filtering to upcoming is the caller's
   * job via `isUpcomingEvent`, so the page can decide what "past" means. */
  async getEvents(): Promise<PublicEvent[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client
      .from('public_events')
      .select('*')
      .order('start_at');
    if (error) throw new Error(CONTENT_LOAD_ERROR);
    return (data as PublicEvent[]) ?? [];
  },

  /** Published announcements, newest first. The view already drops drafts and
   * not-yet-due scheduled posts — do not re-filter on `published_at` here. */
  async getPosts(): Promise<PublicPost[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client
      .from('public_posts')
      .select('*')
      .order('published_at', { ascending: false });
    if (error) throw new Error(CONTENT_LOAD_ERROR);
    return (data as PublicPost[]) ?? [];
  },

  /** The category catalog, in the LGU's own sort order. */
  async getPostCategories(): Promise<PublicPostCategory[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('public_post_categories').select('*');
    if (error) throw new Error(CONTENT_LOAD_ERROR);
    return ((data as PublicPostCategory[]) ?? []).sort((a, b) => a.sort_order - b.sort_order);
  },
};
