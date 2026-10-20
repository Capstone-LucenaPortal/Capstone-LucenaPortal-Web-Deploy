/**
 * The single source for how a citizen reaches the city.
 *
 * Before this module the same phone numbers and email addresses were written
 * out as literals in four independent places — the home page's contact card and
 * footer, `LCCAbout`, `incident/page.tsx` and `yellow-card/page.tsx` — which
 * had already drifted apart from each other.
 *
 * What is DB-sourced and what is not:
 *
 * - `trunkline` and `office_hours` live on `public_site_info` and are read
 *   through `catalogService.getSiteInfo()`. Those are LGU-editable today.
 * - Emergency hotlines live on `public_site_info_entries` (kind
 *   'emergency_hotline') and are read by the home page directly.
 * - `agency_name` is on `public_site_info` too, and the Acknowledgement Receipt
 *   reads it from there. `AGENCY_NAME` below is the copy static prose uses; see
 *   its own note for why that one is duplicated deliberately.
 * - Everything else below has NO home in the schema yet. `public_site_info_entries`
 *   currently supports only 'emergency_hotline' and 'floor_directory' kinds, so
 *   the general contact email, the helpdesk address and the LCC's own booking
 *   line cannot be sourced from the database without a new entry kind. That is
 *   filed as a SuperStaff/DB ask in `docs/citizen-surface-follow-ups.md`; until
 *   it lands, these constants are the one place to edit them.
 *
 * Anything here that cannot be verified against a real, monitored channel must
 * be removed rather than invented — a government portal publishing a number
 * that rings nowhere is worse than publishing no number.
 */

/**
 * The agency's canonical name, settled by DB layer `l66` and stored in
 * `site_info.agency_name`.
 *
 * Unlike the constants below, this one *does* have a home in the schema: it is
 * readable through `public_site_info.agency_name`, and the Acknowledgement
 * Receipt renders the DB value rather than this literal, because a receipt is
 * a record and must print what the database says. Static page copy hardcodes
 * it instead — the name changes about as often as the city is renamed, and
 * making every page of prose await a catalog fetch to print four words buys a
 * loading state and a fallback for no benefit.
 *
 * Because it is a copy, it can drift. `contact-info.test.ts` pins it to the
 * value read from the Sandbox project by hand on 2026-10-01 — that is a
 * tripwire for an accidental edit here, NOT a check against the live row. If
 * the LGU ever edits `site_info.agency_name`, nothing fails; the receipt
 * follows the new value and this literal has to be updated to match.
 *
 * Note the word order. The reversed form — "Lucena City" first — is not the
 * agency's name at all; it belongs only to `OFFICE_ADDRESS_LINES[0]` below,
 * which names the building on Diversion Road.
 */
export const AGENCY_NAME = 'City Government of Lucena';

/**
 * The city office that processes Yellow Cards — **not yet known**.
 *
 * The portal used to name two different ones — a welfare office on the
 * application screens, a health office on the verification and revoked-card
 * screens; issue #12 lists both spellings and all five places. A citizen could be
 * sent to the wrong counter by whichever screen they happened to read. (Spelling
 * either name here would trip this file's own scan, which does not tell code from
 * comment.)
 *
 * Nothing available can settle it. `officers_of_record` is the database's own home
 * for this, and its `yellow_card` row reads
 * `unit = 'Pending nomination (SCRUM-105)'` with `is_placeholder = true`
 * (verified on the Sandbox 2026-10-02). No design document names an office, and no
 * sibling portal names one either — this app was the only surface asserting it.
 *
 * So it stays null and the copy says the agency instead, which is true whoever is
 * nominated. When SCRUM-105 answers it, setting the name here updates the three
 * screens that tell a citizen whom to contact — verify (x2) and the revoked-card
 * panel on the profile. It does NOT reach the two screens that describe what
 * happens to an application rather than whom to contact; those carry a
 * `TODO(backend)` saying so, because whether naming an office helps there is a
 * copy decision, not a find-and-replace. `officers_of_record` needs the same value.
 *
 * `contact-info.test.ts` covers both states of this constant and scans the pages
 * for a hardcoded office name.
 */
const YELLOW_CARD_OFFICE: string | null = null;

/**
 * How to refer to whoever answers for Yellow Cards. Reads as "the …", so callers
 * write `contact the ${yellowCardOfficeName()}`.
 *
 * Takes the office as a parameter so both states are testable before SCRUM-105
 * lands; callers pass nothing.
 */
export function yellowCardOfficeName(office: string | null = YELLOW_CARD_OFFICE): string {
  return office ?? AGENCY_NAME;
}

/** General enquiries. */
export const CONTACT_EMAIL = 'info@lucena-city.gov.ph';

/** Portal/e-services support. */
export const HELPDESK_EMAIL = 'helpdesk@lucena-city.gov.ph';

/** Official page. Used for the footer link and the homepage feed iframe. */
export const FACEBOOK_PAGE_URL = 'https://www.facebook.com/lucenalguofficial';

/** Physical address of the City Government Complex, as three display lines. */
export const OFFICE_ADDRESS_LINES = [
  'Lucena City Government Complex',
  'Diversion Road, Brgy. Kanlurang Mayao',
  'Lucena City, Quezon, Philippines',
] as const;

/**
 * Fallback trunkline, used only until `public_site_info.trunkline` loads (or if
 * it is null). Prefer the DB value everywhere — pass it through
 * `resolveTrunkline` rather than reading this constant directly.
 */
const FALLBACK_TRUNKLINE = '(042) 373-1121';

/** The trunkline to display: the LGU's own value when present. */
export function resolveTrunkline(fromSiteInfo: string | null | undefined): string {
  return fromSiteInfo?.trim() || FALLBACK_TRUNKLINE;
}

/**
 * A `tel:` href for a Philippine number written for humans.
 *
 * Strips spaces, dashes and parentheses, and rewrites a leading 0 to the +63
 * country code so the link dials correctly from a phone roaming abroad — a
 * bare `tel:(042) 373-1121` is not reliably dialable.
 */
export function telHref(value: string): string {
  const digits = value.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return `tel:${digits}`;
  if (digits.startsWith('0')) return `tel:+63${digits.slice(1)}`;
  return `tel:${digits}`;
}
