import { OFFICE_ADDRESS_LINES, resolveTrunkline } from '@/portals/citizen/lib/contact-info';
import type {
  BookingConfig,
  IncidentConfig,
  SiteInfo,
  YellowCardConfig,
  YellowCardDocumentType,
} from '@/portals/citizen/lib/supabase/catalogs';

/**
 * The Citizen's Charter (RA 11032) for the three services this portal delivers.
 *
 * Every figure a charter commits the city to — processing time, fee, payment
 * window — is read at runtime from the same anon-readable `public_*` catalogs
 * the service pages themselves use, so the published commitment cannot drift
 * from what the database actually enforces. Nothing here is hardcoded that the
 * schema already knows.
 *
 * Where a catalog is unavailable (mock mode, or no backend configured) each
 * field degrades to prose rather than to a blank or a `null` — the same idiom
 * `/yellow-card` uses for its processing-time line. A charter with a hole in it
 * is worse than one that says "varies".
 */

export type CharterServiceCode = 'yellow_card' | 'incident' | 'lcc_booking';

export interface CharterService {
  code: CharterServiceCode;
  name: string;
  /** The portal route where a citizen starts this service. */
  href: string;
  summary: string;
  whoMayAvail: string;
  requirements: string[];
  fee: string;
  processingTime: string;
  steps: string[];
}

export interface CharterOffice {
  /** Null when `public_site_info` publishes none — the row is then omitted. */
  hours: string | null;
  trunkline: string;
  addressLines: readonly string[];
}

export interface Charter {
  services: CharterService[];
  office: CharterOffice;
}

/** Everything `buildCharter` needs, so the merge itself stays pure. */
export interface CharterSources {
  yellowCard: YellowCardConfig | null;
  yellowCardDocuments: YellowCardDocumentType[];
  incident: IncidentConfig | null;
  booking: BookingConfig | null;
  siteInfo: SiteInfo | null;
}

function businessDays(n: number): string {
  return `${n} business day${n === 1 ? '' : 's'}`;
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

function yellowCardRequirements(documents: YellowCardDocumentType[]): string[] {
  const fromCatalog = [...documents]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((d) => (d.is_required ? d.label : `${d.label} (optional)`));

  return [...fromCatalog, 'A completed application form on this portal'];
}

function yellowCard(sources: CharterSources): CharterService {
  return {
    code: 'yellow_card',
    name: 'Yellow Card Application',
    href: '/yellow-card',
    summary:
      'The city ID that identifies a resident of Lucena and gives access to city assistance programmes and free skills training.',
    whoMayAvail: 'Any registered voter of Lucena City who is at least 18 years old.',
    requirements: yellowCardRequirements(sources.yellowCardDocuments),
    fee: 'Free',
    processingTime: sources.yellowCard
      ? businessDays(sources.yellowCard.processing_time_target_days)
      : 'A few business days',
    steps: [
      'Create a portal account and complete your profile.',
      'Fill in the Yellow Card application form and upload the required document.',
      'The city verifies your submitted documents.',
      'Track the result on your dashboard and claim the card when it is approved.',
    ],
  };
}

function incidentResponseTimes(config: IncidentConfig | null): string {
  if (!config) return 'Varies by the severity assigned to the report';
  return [
    `Critical: ${config.sla_hours_critical} hours`,
    `High: ${config.sla_hours_high} hours`,
    `Medium: ${config.sla_hours_medium} hours`,
    `Low: ${config.sla_hours_low} hours`,
  ].join(' · ');
}

function incident(sources: CharterSources): CharterService {
  const { incident: config } = sources;
  const steps = [
    'Sign in and choose the type of incident you are reporting.',
    'Describe what happened, give the location, and attach a photo if you have one.',
    'The report is routed to the responsible city department.',
    'Follow the status on your dashboard and confirm once it is resolved.',
  ];

  return {
    code: 'incident',
    name: 'Incident Report',
    href: '/incident',
    summary:
      'Report a problem in your barangay — a broken streetlight, a road hazard, uncollected waste — to the city department responsible for it.',
    whoMayAvail: 'Any resident with a portal account.',
    requirements: [
      'A portal account',
      'The location of the incident',
      'A description of what happened',
      'A photo, where one helps the responding department',
    ],
    fee: 'Free',
    processingTime: incidentResponseTimes(config),
    steps: config
      ? [
          ...steps,
          `You have ${plural(config.auto_close_day, 'day')} to confirm or reopen a resolved report before the city closes it.`,
        ]
      : steps,
  };
}

function bookingFee(config: BookingConfig | null): string {
  // Deliberately never states a peso figure. `booking_price()` in the database
  // is the only authority on the venue fee, and `lcc-about.tsx` already refuses
  // to pre-quote for the same reason: a number the system will not honour is
  // worse than no number. The charter states the terms, not the price.
  if (!config) {
    return 'The venue fee is confirmed on the official quote the city issues for your booking. A downpayment is required to hold the date.';
  }
  return `The venue fee is confirmed on the official quote the city issues for your booking. A ${config.downpayment_pct}% downpayment is due within ${plural(config.payment_window_hours, 'hour')} of the quote to hold the date, with the balance due ${plural(config.balance_due_days_before_event, 'day')} before the event.`;
}

function lccBooking(sources: CharterSources): CharterService {
  const { booking: config } = sources;

  return {
    code: 'lcc_booking',
    name: 'Lucena Convention Center (LCC) Booking',
    href: '/lcc',
    summary:
      'Reserve the Atrium, the Sports Arena, the full facility, or the venue for a rehearsal or practice session.',
    whoMayAvail:
      'Any resident, organisation, or government office with a portal account.',
    requirements: [
      'A portal account',
      'The event date, start time, and duration',
      'The event classification, which decides whether a discounted rate applies',
      'A supporting organisation document, where a discounted rate is claimed',
    ],
    fee: bookingFee(config),
    processingTime: config
      ? `The city issues your quote after reviewing the request. Bookable hours run ${config.opening_hour}:00 to ${config.closing_hour}:00, with a minimum of ${plural(config.min_duration_hours, 'hour')} per booking.`
      : 'The city issues your quote after reviewing the request.',
    steps: [
      'Sign in and check the availability calendar for your date.',
      'Complete the booking form and submit it.',
      'The city reviews the request and issues an official quote.',
      'Pay the downpayment within the payment window to confirm the reservation.',
    ],
  };
}

export function buildCharter(sources: CharterSources): Charter {
  return {
    services: [yellowCard(sources), incident(sources), lccBooking(sources)],
    office: {
      hours: sources.siteInfo?.office_hours?.trim() || null,
      trunkline: resolveTrunkline(sources.siteInfo?.trunkline),
      addressLines: OFFICE_ADDRESS_LINES,
    },
  };
}
