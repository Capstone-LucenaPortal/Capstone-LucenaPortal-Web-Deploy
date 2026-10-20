import { describe, it, expect } from 'vitest';
import type {
  BookingConfig,
  IncidentConfig,
  SiteInfo,
  YellowCardConfig,
  YellowCardDocumentType,
} from '@/portals/citizen/lib/supabase/catalogs';
import { buildCharter, type CharterSources } from '@/portals/citizen/features/content/lib/citizens-charter';

/** The sandbox's real values, so a drift in the fallbacks is visible here. */
const LIVE: CharterSources = {
  yellowCard: { processing_time_target_days: 2 } satisfies YellowCardConfig,
  yellowCardDocuments: [
    { code: 'voter_id', label: "Valid Voter's ID", is_required: true, sort_order: 1 },
  ] satisfies YellowCardDocumentType[],
  incident: {
    sla_hours_critical: 4,
    sla_hours_high: 8,
    sla_hours_medium: 24,
    sla_hours_low: 72,
    nudge_day: 5,
    auto_close_day: 7,
    confirmation_window_days: 3,
    max_active_reports_per_citizen: 3,
    max_photos_per_cycle: 3,
  } satisfies IncidentConfig,
  booking: {
    downpayment_pct: 50,
    payment_window_hours: 72,
    min_duration_hours: 6,
    opening_hour: 6,
    closing_hour: 22,
    balance_due_days_before_event: 7,
  } satisfies BookingConfig,
  siteInfo: {
    trunkline: '(042) 788-2298',
    office_hours: 'Monday to Friday, 8:00 AM – 5:00 PM',
  } satisfies SiteInfo,
};

/** Mock mode: every catalog read returns null/[] rather than faking rows. */
const EMPTY: CharterSources = {
  yellowCard: null,
  yellowCardDocuments: [],
  incident: null,
  booking: null,
  siteInfo: null,
};

function serviceByCode(sources: CharterSources, code: string) {
  const found = buildCharter(sources).services.find((s) => s.code === code);
  if (!found) throw new Error(`no charter service with code ${code}`);
  return found;
}

describe('buildCharter', () => {
  it('publishes exactly the three portal services', () => {
    expect(buildCharter(LIVE).services.map((s) => s.code)).toEqual([
      'yellow_card',
      'incident',
      'lcc_booking',
    ]);
  });

  describe('Yellow Card', () => {
    it('states the processing time from yellow card config', () => {
      expect(serviceByCode(LIVE, 'yellow_card').processingTime).toBe('2 business days');
    });

    it('singularises a one-day processing target', () => {
      const oneDay = { ...LIVE, yellowCard: { processing_time_target_days: 1 } };
      expect(serviceByCode(oneDay, 'yellow_card').processingTime).toBe('1 business day');
    });

    it('falls back to prose when the config is unavailable', () => {
      expect(serviceByCode(EMPTY, 'yellow_card').processingTime).toBe('A few business days');
    });

    it('lists the required documents from the document-type catalog', () => {
      expect(serviceByCode(LIVE, 'yellow_card').requirements).toEqual([
        "Valid Voter's ID",
        'A completed application form on this portal',
      ]);
    });

    it('marks optional documents as optional', () => {
      const withOptional = {
        ...LIVE,
        yellowCardDocuments: [
          ...LIVE.yellowCardDocuments,
          { code: 'brgy_cert', label: 'Barangay Certificate', is_required: false, sort_order: 2 },
        ],
      };
      expect(serviceByCode(withOptional, 'yellow_card').requirements).toContain(
        'Barangay Certificate (optional)',
      );
    });

    it('is free of charge', () => {
      expect(serviceByCode(LIVE, 'yellow_card').fee).toBe('Free');
    });
  });

  describe('Incident Report', () => {
    it('states every response target from incident config', () => {
      expect(serviceByCode(LIVE, 'incident').processingTime).toBe(
        'Critical: 4 hours · High: 8 hours · Medium: 24 hours · Low: 72 hours',
      );
    });

    it('falls back to prose when the config is unavailable', () => {
      expect(serviceByCode(EMPTY, 'incident').processingTime).toBe(
        'Varies by the severity assigned to the report',
      );
    });

    it('is free of charge', () => {
      expect(serviceByCode(LIVE, 'incident').fee).toBe('Free');
    });
  });

  describe('LCC Booking', () => {
    it('states the downpayment and payment window from booking config', () => {
      expect(serviceByCode(LIVE, 'lcc_booking').fee).toContain('50%');
      expect(serviceByCode(LIVE, 'lcc_booking').fee).toContain('72 hours');
    });

    it('never quotes a venue fee, because only the server may set one', () => {
      const { fee } = serviceByCode(LIVE, 'lcc_booking');
      expect(fee).not.toMatch(/₱|PHP|\bpeso/i);
      expect(fee).toContain('quote');
    });

    it('falls back to prose when the config is unavailable', () => {
      const { fee } = serviceByCode(EMPTY, 'lcc_booking');
      expect(fee).toContain('quote');
      expect(fee).not.toMatch(/\bnull\b|\bundefined\b|NaN/);
    });
  });

  describe('office details', () => {
    it('uses the office hours and trunkline the LGU published', () => {
      expect(buildCharter(LIVE).office).toMatchObject({
        hours: 'Monday to Friday, 8:00 AM – 5:00 PM',
        trunkline: '(042) 788-2298',
      });
    });

    it('falls back to the shared trunkline constant when site info is empty', () => {
      expect(buildCharter(EMPTY).office.trunkline).toBe('(042) 373-1121');
    });

    // `contact-info.ts` is explicit that an unverifiable channel must be removed
    // rather than invented, and every existing call site omits office hours when
    // `public_site_info` has none. A charter states a commitment, so a guessed
    // opening time here would be worse than a missing one.
    it('omits office hours rather than inventing them when site info is empty', () => {
      expect(buildCharter(EMPTY).office.hours).toBeNull();
    });
  });

  it('never renders a null, undefined or NaN into any published field', () => {
    for (const service of buildCharter(EMPTY).services) {
      const published = [
        service.name,
        service.summary,
        service.whoMayAvail,
        service.fee,
        service.processingTime,
        ...service.requirements,
        ...service.steps,
      ];
      for (const field of published) {
        expect(field).not.toMatch(/\bnull\b|\bundefined\b|NaN/);
        expect(field.trim()).not.toBe('');
      }
    }
  });
});
