import { describe, it, expect } from 'vitest';
import {
  DPA_ELEMENT_LABELS,
  PRIVACY_SECTIONS,
  findSection,
  uncoveredDpaElements,
  type DpaElement,
} from '@/portals/citizen/features/content/lib/privacy-notice';

/**
 * RA 10173 s.16(b) lists nine sub-items a data subject must be furnished with.
 * The S4-04 ticket refers to eight and numbers retention as (7); the statute
 * puts retention at (8) and the right to complain at (9). Covering all nine
 * satisfies the acceptance criterion under either numbering.
 */
const ALL_ELEMENTS: DpaElement[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

describe('privacy notice — RA 10173 s.16(b) coverage', () => {
  it('covers every statutory element', () => {
    expect(uncoveredDpaElements(PRIVACY_SECTIONS)).toEqual([]);
  });

  it('gives every statutory element a label, so a gap names itself', () => {
    for (const element of ALL_ELEMENTS) {
      expect(DPA_ELEMENT_LABELS[element]).toBeTruthy();
    }
  });

  it('tags no section with an element outside the statute', () => {
    for (const section of PRIVACY_SECTIONS) {
      for (const element of section.elements) {
        expect(ALL_ELEMENTS).toContain(element);
      }
    }
  });

  it('publishes no empty section', () => {
    for (const section of PRIVACY_SECTIONS) {
      expect(section.title.trim()).not.toBe('');
      expect(section.body.trim()).not.toBe('');
    }
  });
});

describe('retention (s.16(b)(8))', () => {
  // The ops checklist (2026-08-18-security-ops-checklist.md:147-151) says not to
  // commit to a specific retention period until the LGU decides one. This test
  // is that instruction made executable — if someone later writes "5 years" in
  // here, the suite says no until the checklist item is ticked.
  it('states the criteria without committing to a duration', () => {
    const { body } = findSection('Data Retention');
    expect(body).not.toMatch(/\b\d+\s*(year|month|week|day)s?\b/i);
  });

  it('says a formal schedule is still pending', () => {
    expect(findSection('Data Retention').body.toLowerCase()).toContain('pending');
  });

  it('carries the profile-removal sentence the design document specified', () => {
    // Verbatim from Central-System-Documents/db-plan-04-platform.md:348.
    expect(findSection('Data Retention').body).toContain(
      'Your profile can be removed from the portal. Records of applications, reports and bookings you submitted are retained as official records of the city.',
    );
  });
});

describe('right to complain (s.16(b)(9))', () => {
  it('names the National Privacy Commission', () => {
    expect(findSection('Your Rights').body).toContain('National Privacy Commission');
  });

  it('tells the citizen they may lodge a complaint there', () => {
    expect(findSection('Your Rights').body.toLowerCase()).toContain('complaint');
  });
});

describe('anonymity scope on incident reports', () => {
  const anonymity = () => findSection('Anonymous Incident Reports').body;

  // db-plan-02-incidents.md:365,381 — responder_incidents hides the reporter's
  // name but exposes reporter_phone even when is_anonymous is true. A notice
  // that said "anonymous to responders" would be wrong.
  it('discloses that the responding department still sees your number', () => {
    expect(anonymity().toLowerCase()).toContain('phone');
  });

  it('discloses that the report stays linked to the account in the database', () => {
    expect(anonymity().toLowerCase()).toMatch(/linked|recorded|stored/);
  });

  it('does not claim the report is anonymous to the responder', () => {
    expect(anonymity()).not.toMatch(/anonymous to (the )?responder/i);
  });
});

describe('legal basis (s.16(b)(3))', () => {
  it('states a basis other than consent', () => {
    const section = PRIVACY_SECTIONS.find((s) => s.elements.includes(3));
    expect(section).toBeDefined();
    expect(section!.body.toLowerCase()).toMatch(/mandate|legal obligation|public authority/);
  });
});

/**
 * DB layer `l64` (SCRUM-121) stood up the email channel: `notify_citizen` writes
 * an `email` row beside every `in_app` row and the `send-email-queue` worker
 * sends it. Verified live on the Sandbox project 2026-10-01.
 *
 * §2 denied all of it. A notice that understates the processing actually
 * performed is a defect under s.16(b) in its own right, so this is the one thing
 * in this file that could not simply be left stale. These tests pin the
 * disclosure, and pin the four ways it is easy to get wrong.
 */
describe('email notification channel (DB layer l64)', () => {
  const purpose = () => findSection('How We Use Your Information').body;

  it('denies no automated email anywhere in the notice', () => {
    for (const section of PRIVACY_SECTIONS) {
      expect(section.body).not.toMatch(/do not\b[^.]{0,60}\bemail/i);
    }
  });

  it('discloses in §2 that status notices are sent by email', () => {
    expect(purpose()).toMatch(/sent by email/i);
  });

  // The overclaim this edit exists to remove, in its second form. "Any decision
  // or update" is as false as "every stage": `route_incident`,
  // `resolve_incident`, `reject_incident`, `release_incident` and
  // `force_release_incident` all record a decision and call `notify_citizen`
  // nowhere (verified on the Sandbox 2026-10-01). So §2 has to name the events
  // that do notify, and say outright that not everything does.
  it('names the events that notify rather than claiming all of them do', () => {
    expect(purpose()).toMatch(/Yellow Card/);
    expect(purpose()).toMatch(/booking/i);
    expect(purpose()).toMatch(/incident/i);
    expect(purpose()).not.toMatch(/at each stage|every stage|(?:an?y?) ?decision or (?:an? )?update/i);
  });

  it('says plainly that some steps produce no notice', () => {
    expect(purpose()).toMatch(/not every step/i);
  });

  it('attributes delivery to a third party rather than implying the city sends it', () => {
    expect(purpose()).toMatch(/third[- ]party email service provider/i);
  });

  // Mail goes to `auth.users.email`, the sign-in address `claim_email_batch`
  // joins on — NOT the `citizens.email` the profile screen shows. The two cannot
  // currently diverge (`update_citizen_profile` takes no `p_email`), but the
  // notice must not name the profile address as the destination.
  it('names the sign-in address as the destination, not the profile email', () => {
    expect(purpose()).toMatch(/sign in with|sign-in address/i);
    expect(purpose()).not.toMatch(/profile email|email (shown|on) your profile/i);
  });

  // `status = 'sent'` means the provider ACCEPTED the message, not that it
  // arrived; bounces are not recorded, so a notice to a dead address reads
  // `sent` forever. The notice may say what is sent, never what is received.
  it('promises no delivery', () => {
    for (const section of PRIVACY_SECTIONS) {
      expect(section.body).not.toMatch(/you will receive|will be delivered to you/i);
    }
  });

  // Element 5 is recipients, and a provider handling the text of a decision is
  // one of them.
  it('names the email provider as a recipient in the data-sharing section', () => {
    expect(findSection('Data Sharing').body).toMatch(/email service provider/i);
  });

  // §5 already disclosed the Supabase ap-southeast-1 transfer. Delivery adds a
  // second processor outside the Philippines, so the cross-border disclosure has
  // to cover it rather than reading as if Supabase were the only one.
  it('covers the delivery provider in the cross-border transfer disclosure', () => {
    const stored = findSection('Where Your Data Is Stored').body;
    expect(stored).toMatch(/email service provider/i);
    expect(stored).toMatch(/outside the Philippines/i);
  });

  // `claim_email_batch` returns (notification_id, recipient_email, subject,
  // message, attempt) — there is no name column, so claiming the provider
  // receives the citizen's name would overstate what crosses the border.
  it('claims no more than the provider actually receives', () => {
    expect(findSection('Where Your Data Is Stored').body).not.toMatch(/your name/i);
  });

  // SMS really is still unimplemented, so this denial must survive the edit that
  // removed the email one.
  it('still denies SMS, which remains unimplemented', () => {
    expect(purpose()).toMatch(/do not send[^.]{0,40}SMS|no SMS/i);
  });
});
