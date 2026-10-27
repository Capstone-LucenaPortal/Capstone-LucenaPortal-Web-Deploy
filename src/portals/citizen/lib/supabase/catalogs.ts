import { getSupabaseClient } from '@/portals/citizen/lib/supabase/client';

export interface CatalogOption {
  code: string;
  label: string;
}

export interface YellowCardConfig {
  processing_time_target_days: number;
}

export interface BookingVenueRate {
  venue_code: string;
  tier: string;
  base_fee: number | null;
  extension_hourly: number | null;
  hourly_rate: number | null;
  requires_quote: boolean;
}

/**
 * A `public_booking_rehearsal_rates` row. Since DB layer l55, rehearsal pricing
 * lives here and NOT on `public_booking_venue_rates.hourly_rate` — that column
 * is null for both `rehearsal_practice` rows. Rates are tier-independent: the
 * same hourly figure applies whatever `rate_tier` the city assigns.
 */
export interface BookingRehearsalRate {
  code: string;
  label: string;
  hourly_rate: number;
  sort_order: number;
}

export interface IncidentTypeDetail {
  code: string;
  label: string;
  base_level: string;
  category_code: string;
  default_department_code: string | null;
  sort_order: number;
}

export interface IncidentConfig {
  sla_hours_critical: number;
  sla_hours_high: number;
  sla_hours_medium: number;
  sla_hours_low: number;
  /** Days after `resolved_at` the sweeper nudges the reporter to confirm. */
  nudge_day: number;
  /** Days a citizen has to confirm or reopen a `resolved` report before the
   * sweeper closes it as `auto_confirmed`. Drives the resolved card's deadline. */
  auto_close_day: number;
  /** Days after `submitted_at` a never-verified report is closed as
   * `expired_unverified`. Drives the unverified card's deadline. */
  confirmation_window_days: number;
  max_active_reports_per_citizen: number;
  max_photos_per_cycle: number;
}

export interface BookingVenueDetail {
  code: string;
  label: string;
  capacity_label: string | null;
  is_hourly: boolean;
  sort_order: number;
}

export interface BookingConfig {
  downpayment_pct: number;
  payment_window_hours: number;
  min_duration_hours: number;
  opening_hour: number;
  closing_hour: number;
  balance_due_days_before_event: number;
}

/** The single `public_site_info` row — trunkline and office hours, LGU-editable. */
export interface SiteInfo {
  trunkline: string | null;
  office_hours: string | null;
}

/** A `public_site_info_entries` row. The view exposes no primary key, so
 * `sort_order` (unique within a `kind`) is what callers key React lists on.
 * Two rows may legitimately share a `label` — never de-duplicate on it. */
export interface SiteInfoEntry {
  kind: string;
  label: string;
  value: string;
  sort_order: number;
}

export interface YellowCardDocumentType {
  code: string;
  label: string;
  is_required: boolean;
  sort_order: number;
}

/** Citizen-facing copy for any catalog-view read failure. Never interpolate
 * error.message here — it's raw Postgres/PostgREST text (view/column names). */
const CATALOG_LOAD_ERROR = 'Could not load reference data right now. Please try again later.';

// Catalogs are small, staff-authored, and change rarely; a per-session TTL
// cache keeps a traffic spike from multiplying identical catalog reads.
const CATALOG_TTL_MS = 5 * 60 * 1000;
const catalogCache = new Map<string, { at: number; data: unknown }>();

export function _clearCatalogCacheForTests(): void {
  catalogCache.clear();
}

async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = catalogCache.get(key);
  if (hit && Date.now() - hit.at < CATALOG_TTL_MS) return hit.data as T;
  const data = await fetcher();
  catalogCache.set(key, { at: Date.now(), data });
  return data;
}

/** Read a public_* catalog view. Returns [] when no backend is configured
 * (that branch is intentionally not cached — there's nothing to memoize). */
async function readCatalog(view: string): Promise<Array<Record<string, unknown>>> {
  const client = getSupabaseClient();
  if (!client) return [];
  return cached(view, async () => {
    const { data, error } = await client.from(view).select('*');
    if (error) throw new Error(CATALOG_LOAD_ERROR);
    return (data as Array<Record<string, unknown>>) ?? [];
  });
}

/** Pure: catalog rows → sorted {code,label}. `labelKey` is 'name' for barangays. */
export function toOptions(
  rows: Array<Record<string, unknown>>,
  labelKey = 'label',
): CatalogOption[] {
  return rows
    .map((r) => ({
      code: String(r.code),
      label: String(r[labelKey]),
      sort: Number(r.sort_order ?? 0),
    }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ code, label }) => ({ code, label }));
}

export const catalogService = {
  async getBarangays() { return toOptions(await readCatalog('public_barangays'), 'name'); },
  async getGenders() { return toOptions(await readCatalog('public_genders')); },
  async getCivilStatuses() { return toOptions(await readCatalog('public_civil_statuses')); },
  async getIncidentTypes() { return toOptions(await readCatalog('public_incident_types')); },
  async getDepartments() { return toOptions(await readCatalog('public_departments')); },
  async getBookingClassifications() { return toOptions(await readCatalog('public_booking_classifications')); },
  async getBookingEventTypes() { return toOptions(await readCatalog('public_booking_event_types')); },
  /** Full incident-type rows — the dropdown needs `base_level` to show the level badge. */
  async getIncidentTypeDetails(): Promise<IncidentTypeDetail[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    return cached('incident_type_details', async () => {
      const { data, error } = await client.from('public_incident_types').select('*');
      if (error) throw new Error(CATALOG_LOAD_ERROR);
      return ((data as IncidentTypeDetail[]) ?? []).sort((a, b) => a.sort_order - b.sort_order);
    });
  },

  async getIncidentConfig(): Promise<IncidentConfig | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    return cached('incident_config', async () => {
      const { data, error } = await client.from('public_incident_config').select('*').maybeSingle();
      if (error) throw new Error(CATALOG_LOAD_ERROR);
      return (data as IncidentConfig) ?? null;
    });
  },

  async getYellowCardConfig(): Promise<YellowCardConfig | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    return cached('yellow_card_config', async () => {
      const { data, error } = await client.from('public_yellow_card_config').select('*').maybeSingle();
      if (error) throw new Error(CATALOG_LOAD_ERROR);
      return (data as YellowCardConfig) ?? null;
    });
  },

  async getBookingVenueRates(): Promise<BookingVenueRate[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    return cached('booking_venue_rates', async () => {
      const { data, error } = await client.from('public_booking_venue_rates').select('*');
      if (error) throw new Error(CATALOG_LOAD_ERROR);
      return (data as BookingVenueRate[]) ?? [];
    });
  },

  /** Rehearsal hourly rates (l55). The view already drops inactive rows — do
   * not re-filter on `is_active` here; it isn't even exposed. */
  async getRehearsalRates(): Promise<BookingRehearsalRate[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    return cached('booking_rehearsal_rates', async () => {
      const { data, error } = await client.from('public_booking_rehearsal_rates').select('*');
      if (error) throw new Error(CATALOG_LOAD_ERROR);
      return ((data as BookingRehearsalRate[]) ?? []).sort((a, b) => a.sort_order - b.sort_order);
    });
  },

  async getBookingVenueDetails(): Promise<BookingVenueDetail[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    return cached('booking_venue_details', async () => {
      const { data, error } = await client.from('public_booking_venues').select('*');
      if (error) throw new Error(CATALOG_LOAD_ERROR);
      return (data as BookingVenueDetail[]) ?? [];
    });
  },

  async getSiteInfo(): Promise<SiteInfo | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    return cached('site_info', async () => {
      const { data, error } = await client.from('public_site_info').select('*').maybeSingle();
      if (error) throw new Error(CATALOG_LOAD_ERROR);
      return (data as SiteInfo) ?? null;
    });
  },

  /** Rows of one `kind` ('emergency_hotline', 'floor_directory'), in sort order.
   * Filtering on `kind` is a content filter, not a visibility one — the view
   * already drops inactive rows, so never add an `is_active` filter here. */
  async getSiteInfoEntries(kind: string): Promise<SiteInfoEntry[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    return cached(`site_info_entries:${kind}`, async () => {
      const { data, error } = await client
        .from('public_site_info_entries')
        .select('*')
        .eq('kind', kind)
        .order('sort_order');
      if (error) throw new Error(CATALOG_LOAD_ERROR);
      return (data as SiteInfoEntry[]) ?? [];
    });
  },

  async getEmergencyHotlines(): Promise<SiteInfoEntry[]> {
    return catalogService.getSiteInfoEntries('emergency_hotline');
  },

  async getFloorDirectory(): Promise<SiteInfoEntry[]> {
    return catalogService.getSiteInfoEntries('floor_directory');
  },

  /** Documents a Yellow Card applicant must attach. Today the catalog holds a
   * single required `voter_id` row; the form reads it rather than assuming it. */
  async getYellowCardDocumentTypes(): Promise<YellowCardDocumentType[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    return cached('yellow_card_document_types', async () => {
      const { data, error } = await client.from('public_yellow_card_document_types').select('*');
      if (error) throw new Error(CATALOG_LOAD_ERROR);
      return ((data as YellowCardDocumentType[]) ?? []).sort((a, b) => a.sort_order - b.sort_order);
    });
  },

  async getBookingConfig(): Promise<BookingConfig | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    return cached('booking_config', async () => {
      const { data, error } = await client.from('public_booking_config').select('*').maybeSingle();
      if (error) throw new Error(CATALOG_LOAD_ERROR);
      return (data as BookingConfig) ?? null;
    });
  },
};
