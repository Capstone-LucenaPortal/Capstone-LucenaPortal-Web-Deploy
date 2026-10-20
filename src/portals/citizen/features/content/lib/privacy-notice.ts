import {
  CONTACT_EMAIL,
  HELPDESK_EMAIL,
  OFFICE_ADDRESS_LINES,
} from '@/portals/citizen/lib/contact-info';

/**
 * The privacy notice, as data rather than markup, so its compliance with
 * RA 10173 s.16(b) can be asserted in a test instead of claimed in a review.
 *
 * Each section carries the statutory sub-items it satisfies. `uncoveredDpaElements`
 * turns "all elements present" into something the suite checks on every run — if
 * a future edit drops the only section covering an element, the build says so.
 *
 * Numbering note: the statute lists NINE sub-items under s.16(b). Internal
 * tickets have referred to eight, numbering retention (7) and the right to
 * complain (8); the statute puts them at (8) and (9). This module follows the
 * statute and covers all nine, which satisfies either numbering.
 *
 * ## The email disclosure in §2, §4 and §5 (issue #7, decided 2026-10-01)
 *
 * §2 used to deny automated email outright. DB layer `l64` made that false —
 * see `MyNotification` in `@/features/notifications/types` for how the channel
 * works and which project it is live on. A notice that denies processing a
 * deployment performs is understating it, which is a defect under s.16(b)
 * rather than merely stale copy.
 *
 * The disclosure was written now rather than deferred until `l64` reaches
 * production, deliberately: understating processing is the RA 10173 defect,
 * while disclosing a recipient you may route through is not. The cost, accepted
 * knowingly, is that on a project where the worker is unconfigured this notice
 * describes a channel that stays silent. Deferring instead would have left the
 * live-email deployment denying live processing, which is the worse direction.
 *
 * Four things the wording is careful about, each pinned by a test in
 * `privacy-notice.test.ts`:
 *
 * - It names the events that actually notify. "Any decision or update" would
 *   repeat the overclaim this edit exists to remove: the incident RPCs record
 *   decisions and notify nobody at all.
 * - It says what is **sent**, never what is received.
 * - It names the **sign-in address**, not the profile email the profile screen
 *   shows.
 * - It says "third-party email service provider" as a class rather than naming
 *   Brevo, so changing provider is not an edit to legal copy. §5 lists only what
 *   that provider actually receives: `claim_email_batch` hands it the address,
 *   the subject and the body, and no separate name field.
 *
 * When `l64` reaches production, nothing here needs to change — that is the
 * point of writing it this way round.
 */

export type DpaElement = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const DPA_ELEMENT_LABELS: Record<DpaElement, string> = {
  1: 'Description of the personal information to be entered into the system',
  2: 'Purposes for which they are being or will be processed',
  3: 'Basis of processing, when processing is not based on consent',
  4: 'Scope and method of the personal information processing',
  5: 'The recipients or classes of recipients to whom they are or may be disclosed',
  6: 'Methods utilized for automated access, and the extent to which it is authorized',
  7: 'The identity and contact details of the personal information controller',
  8: 'The period for which the information will be stored',
  9: 'The existence of their rights, including the right to lodge a complaint before the Commission',
};

export interface PrivacySection {
  title: string;
  body: string;
  /** The s.16(b) sub-items this section satisfies. Empty for housekeeping sections. */
  elements: DpaElement[];
}

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    title: '1. Information We Collect',
    elements: [1],
    body: 'When you use the Lucena City E-Services Portal ("the Portal"), we collect the personal information needed to process the specific request you submit. This includes: your full name, date of birth, address, contact number, and email address (account profile); a photo or scan of a government-issued ID, such as a Voter\'s ID, and your Voter\'s ID number (Yellow Card applications); photos you choose to attach to an incident report; and, for Lucena Convention Center (LCC) bookings that claim a discounted rate, a supporting organization document and, where applicable, a payment receipt (e.g., a GCash receipt). We only collect what a given form asks for.',
  },
  {
    title: '2. How We Use Your Information',
    elements: [2],
    body: 'Your information is used to process your applications and requests, verify your identity and eligibility, and let you track the status of your submissions within the Portal (via your dashboard). When a decision is issued on a Yellow Card application, when a booking of yours changes status, and when we follow up on an incident report you filed, a notice is also sent by email to the address you sign in with, delivered on our behalf by a third-party email service provider. Not every step of processing produces a notice. We do not send SMS notifications about the status of your requests.',
  },
  {
    title: '3. Why We Are Allowed to Process Your Information',
    elements: [3],
    body: 'The City Government of Lucena processes your personal information mainly to carry out functions the law gives it, not because you consented to it. Issuing a city identification card, acting on a report of a public hazard, and administering the use of a city-owned venue are mandates of the local government. The Data Privacy Act permits processing on that basis — that it is necessary for a public authority to fulfil its mandate — and also permits processing necessary to perform a contract with you, as with a venue booking. Where we rely on your consent instead, such as attaching a photograph to an incident report, you are asked for it at the point of collection and may decline without losing access to the service itself.',
  },
  {
    title: '4. Data Sharing',
    elements: [5],
    body: 'Your personal data may be shared with relevant City Government departments and offices strictly for the purpose of processing your request, and with the email service provider that delivers status notices to you on our behalf. We do not sell or share your personal information with third parties for marketing purposes.',
  },
  {
    title: '5. Where Your Data Is Stored',
    elements: [4, 5],
    body: 'The Portal is hosted on Supabase infrastructure located in the ap-southeast-1 region (Singapore). This means your personal data is transferred to, and stored on, servers located outside the Philippines for processing. The email service provider that delivers status notices handles the address you sign in with and the text of the notice on its own servers, also outside the Philippines. Both cross-border transfers are disclosed here in accordance with the Data Privacy Act of 2012 (RA 10173).',
  },
  {
    title: '6. Data Storage and Security',
    elements: [4],
    body: 'We implement reasonable administrative, technical, and physical safeguards to protect your personal information against unauthorized access, alteration, disclosure, or destruction. Uploaded documents and photos are stored in access-restricted storage and are not publicly browsable.',
  },
  {
    title: '7. Data Retention',
    elements: [8],
    body: 'How long we keep your information depends on the record, and we do not keep personal information for longer than its purpose requires. Your account profile is kept while your account is active. Yellow Card applications and their supporting documents are kept as records of a decision the city made. Incident reports and their photos are kept as records of a request for city service and how it was resolved. Booking records, supporting documents and payment receipts are kept as financial records of a transaction with the city. Messages you send the helpdesk are kept while the matter is open. The period for each is determined by the purpose the record serves, the city\'s obligation to keep records of its own decisions and transactions, and the retention rules that apply to government financial and administrative records. Your profile can be removed from the portal. Records of applications, reports and bookings you submitted are retained as official records of the city. Removing your profile anonymises it rather than erasing it: your name and contact details are cleared and your sign-in is permanently disabled, while your date of birth, sex and barangay are kept because the city\'s service statistics depend on them and do not identify you on their own. A formal retention schedule stating the period for each record type is pending approval by the City Government, and this notice will be updated to state those periods once it is approved.',
  },
  {
    title: '8. Your Rights',
    elements: [9],
    body: 'In accordance with the Data Privacy Act of 2012, you have the right to be informed about how your personal information is processed; to access the information the city holds about you; to correct it where it is inaccurate; to object to its processing; to request its erasure or blocking where the law allows; to be compensated for damage caused by inaccurate, unlawfully obtained, or unauthorised use of your information; and to obtain a copy of the data you submitted in a portable format. Some of these rights are limited where the city is required to keep a record of a decision or transaction — see Data Retention above. If you believe your rights under the Act have been violated, you may lodge a complaint before the National Privacy Commission, the independent body that enforces the Act, and you may do so whether or not you have raised the matter with the City Government first. The Commission publishes how to file a complaint at privacy.gov.ph. Raising the matter with us first is usually faster, but it is not a precondition.',
  },
  {
    title: '9. Anonymous Incident Reports',
    elements: [2, 4, 5],
    body: 'When you file an incident report you may mark it anonymous. This hides your name from the city department and the field responders handling it — they see "Anonymous" in place of it. It does not make the report anonymous in every respect. Your phone number is still shown to the responding department, deliberately, so that a responder who reaches the location can contact you; a report that nobody can follow up on cannot be acted on. The report also remains linked to your account in the Portal\'s database, so that city staff can administer it and so that you can track it on your dashboard. Marking a report anonymous limits who sees your name. It is not a guarantee that the city does not know who filed it.',
  },
  {
    title: '10. Local Storage and Session Data',
    elements: [6],
    body: 'The Portal uses your browser\'s local storage (not tracking cookies) to keep you signed in between visits. The Portal does not currently use analytics or advertising cookies. Clearing your browser\'s site data will sign you out.',
  },
  {
    title: '11. Embedded Third-Party Content',
    elements: [5],
    body: 'The homepage embeds the City Government\'s official Facebook page feed and a Google Maps view. These load directly from Facebook (Meta Platforms, Inc.) and Google inside isolated frames, which means your browser contacts those services when the page loads and they may set their own cookies under their own privacy policies. The Portal does not run those companies\' scripts and does not share your Portal account data with them.',
  },
  {
    title: '12. Photos You Upload',
    elements: [1, 4],
    body: 'Photos submitted with incident reports may contain embedded metadata (EXIF data), including the location where the photo was taken. Remove this metadata from your device before uploading if you do not wish to share your location.',
  },
  {
    title: '13. Changes to This Policy',
    elements: [],
    body: 'This Privacy Policy may be updated periodically to reflect changes in our practices or applicable laws. Continued use of the Portal after changes are posted constitutes acceptance of the revised policy.',
  },
  {
    title: '14. Who We Are and How to Contact Us',
    elements: [7],
    body: `The personal information controller for the Portal is the City Government of Lucena, with its principal office at ${OFFICE_ADDRESS_LINES.join(', ')}. For questions about this Privacy Policy, to exercise any of the rights described above, or to raise a concern about how your personal information is handled, write to ${CONTACT_EMAIL} for general enquiries or ${HELPDESK_EMAIL} for matters specific to this Portal. You may also call the city trunkline published at the foot of every page. The City Government is in the process of designating a Data Protection Officer as the Act requires; this notice will be updated with the Officer's contact details once that designation is made.`,
  },
];

/** The section whose title contains `name`. Throws rather than returning
 *  undefined, so a renamed section fails loudly at its call site. */
export function findSection(name: string): PrivacySection {
  const found = PRIVACY_SECTIONS.find((s) => s.title.includes(name));
  if (!found) throw new Error(`no privacy notice section matching "${name}"`);
  return found;
}

/** Statutory elements no section claims to cover, ascending. Empty means the
 *  notice satisfies s.16(b) in full. */
export function uncoveredDpaElements(sections: PrivacySection[]): DpaElement[] {
  const covered = new Set(sections.flatMap((s) => s.elements));
  return (Object.keys(DPA_ELEMENT_LABELS) as unknown as string[])
    .map((k) => Number(k) as DpaElement)
    .filter((element) => !covered.has(element))
    .sort((a, b) => a - b);
}
