'use client';

import { useId } from 'react';
import { PhoneInput } from '@/portals/citizen/components/ui/phone-input';
import type { CatalogOption } from '@/portals/citizen/lib/supabase/catalogs';
import type { PrintedCardValues, YellowCardFieldValues } from '@/portals/citizen/features/yellow-card/types';
import { LIMITS } from '@/portals/citizen/lib/validation';

const INPUT_CLASS =
  'w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-text-dark font-sans transition-all focus:outline-none focus:border-lucena-blue focus:shadow-[0_0_0_3px_rgba(0,61,165,0.1)]';
const INPUT_STYLE = { padding: '12px 16px' } as const;
const ROW_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
} as const;
const SECTION_HEADING_STYLE = {
  fontSize: 18,
  fontWeight: 700,
  color: '#003DA5',
  marginBottom: 24,
  paddingBottom: 16,
  borderBottom: '1px solid #DDDDDD',
} as const;

interface YellowCardFieldsProps {
  values: YellowCardFieldValues;
  onChange: (field: keyof YellowCardFieldValues, value: string) => void;
  genders: CatalogOption[];
  civilStatuses: CatalogOption[];
  barangays: CatalogOption[];
}

function Required() {
  return <span style={{ color: '#C62828' }}>*</span>;
}

/**
 * The fields common to applying for and revising a Yellow Card. Purely
 * presentational. The consent checkbox, the document uploader and the
 * eligibility banner stay with the pages, because the two flows differ on all
 * three.
 */
export function YellowCardFields({ values, onChange, genders, civilStatuses, barangays }: YellowCardFieldsProps) {
  const id = useId();
  return (
    <>
      <div style={{ marginBottom: 40 }}>
        <h2 style={SECTION_HEADING_STYLE}>Personal Information</h2>

        <div className="mb-5">
          <label htmlFor={`${id}-voter-id-number`} className="block text-sm font-semibold text-text-dark mb-2"><Required /> Voter&#39;s ID Number</label>
          <input
            id={`${id}-voter-id-number`}
            className={INPUT_CLASS}
            style={INPUT_STYLE}
            type="text"
            placeholder="Enter your Voter's ID number"
            value={values.voterIdNumber}
            onChange={(e) => onChange('voterIdNumber', e.target.value)}
            maxLength={LIMITS.shortText}
          />
        </div>

        <div style={{ ...ROW_STYLE, marginBottom: 20 }}>
          <div className="mb-5">
            <label htmlFor={`${id}-first-name`} className="block text-sm font-semibold text-text-dark mb-2"><Required /> First Name</label>
            <input id={`${id}-first-name`} className={INPUT_CLASS} style={INPUT_STYLE} placeholder="First name" value={values.firstName} onChange={(e) => onChange('firstName', e.target.value)} maxLength={LIMITS.name} />
          </div>
          <div className="mb-5">
            <label htmlFor={`${id}-middle-name`} className="block text-sm font-semibold text-text-dark mb-2">Middle Name</label>
            <input id={`${id}-middle-name`} className={INPUT_CLASS} style={INPUT_STYLE} placeholder="Middle name" value={values.middleName} onChange={(e) => onChange('middleName', e.target.value)} maxLength={LIMITS.name} />
          </div>
          <div className="mb-5">
            <label htmlFor={`${id}-last-name`} className="block text-sm font-semibold text-text-dark mb-2"><Required /> Last Name</label>
            <input id={`${id}-last-name`} className={INPUT_CLASS} style={INPUT_STYLE} placeholder="Last name" value={values.lastName} onChange={(e) => onChange('lastName', e.target.value)} maxLength={LIMITS.name} />
          </div>
        </div>

        <div className="mb-5" style={{ maxWidth: 160 }}>
          <label htmlFor={`${id}-suffix`} className="block text-sm font-semibold text-text-dark mb-2">Suffix</label>
          <select id={`${id}-suffix`} className={INPUT_CLASS} style={INPUT_STYLE} value={values.suffix} onChange={(e) => onChange('suffix', e.target.value)}>
            <option value=""></option>
            {['Jr.', 'Sr.', 'II', 'III', 'IV'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={ROW_STYLE}>
          <div className="mb-5">
            <label htmlFor={`${id}-date-of-birth`} className="block text-sm font-semibold text-text-dark mb-2"><Required /> Date of Birth</label>
            <input id={`${id}-date-of-birth`} className={INPUT_CLASS} style={INPUT_STYLE} type="date" value={values.dateOfBirth} onChange={(e) => onChange('dateOfBirth', e.target.value)} max={new Date().toISOString().slice(0, 10)} min="1906-01-01" />
          </div>
          <div className="mb-5">
            <label htmlFor={`${id}-sex`} className="block text-sm font-semibold text-text-dark mb-2"><Required /> Sex</label>
            <select id={`${id}-sex`} className={INPUT_CLASS} style={INPUT_STYLE} value={values.genderCode} onChange={(e) => onChange('genderCode', e.target.value)}>
              <option value="">Select sex</option>
              {genders.map((g) => <option key={g.code} value={g.code}>{g.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-5">
          <label htmlFor={`${id}-civil-status`} className="block text-sm font-semibold text-text-dark mb-2"><Required /> Civil Status</label>
          <select id={`${id}-civil-status`} className={INPUT_CLASS} style={INPUT_STYLE} value={values.civilStatusCode} onChange={(e) => onChange('civilStatusCode', e.target.value)}>
            <option value="">Select civil status</option>
            {civilStatuses.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 40 }}>
        <h2 style={SECTION_HEADING_STYLE}>Contact Information</h2>

        <div className="mb-5">
          <label htmlFor={`${id}-barangay`} className="block text-sm font-semibold text-text-dark mb-2"><Required /> Barangay</label>
          <select id={`${id}-barangay`} className={INPUT_CLASS} style={INPUT_STYLE} value={values.barangayCode} onChange={(e) => onChange('barangayCode', e.target.value)}>
            <option value="">Select your barangay</option>
            {barangays.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
          </select>
        </div>

        <div className="mb-5">
          <label htmlFor={`${id}-complete-address`} className="block text-sm font-semibold text-text-dark mb-2"><Required /> Complete Address</label>
          <input id={`${id}-complete-address`} className={INPUT_CLASS} style={INPUT_STYLE} placeholder="House No., Street, City" value={values.completeAddress} onChange={(e) => onChange('completeAddress', e.target.value)} maxLength={LIMITS.address} />
        </div>

        <div style={ROW_STYLE}>
          <div className="mb-5">
            <label htmlFor={`${id}-contact-number`} className="block text-sm font-semibold text-text-dark mb-2"><Required /> Contact Number</label>
            <PhoneInput
              id={`${id}-contact-number`}
              className={INPUT_CLASS}
              inputStyle={INPUT_STYLE}
              value={values.contactNumber}
              onChange={(v) => onChange('contactNumber', v)}
            />
          </div>
          <div className="mb-5">
            <label htmlFor={`${id}-email-address`} className="block text-sm font-semibold text-text-dark mb-2"><Required /> Email Address</label>
            <input id={`${id}-email-address`} className={INPUT_CLASS} style={INPUT_STYLE} type="email" placeholder="your@email.com" value={values.emailAddress} onChange={(e) => onChange('emailAddress', e.target.value)} maxLength={LIMITS.email} />
          </div>
        </div>

        <div className="mb-5">
          <label htmlFor={`${id}-years-of-residency`} className="block text-sm font-semibold text-text-dark mb-2"><Required /> Years of Residency in Lucena</label>
          <input id={`${id}-years-of-residency`} className={INPUT_CLASS} style={INPUT_STYLE} type="number" min={0} max={120} placeholder="Number of years" value={values.yearsOfResidency} onChange={(e) => onChange('yearsOfResidency', e.target.value)} />
        </div>
      </div>
    </>
  );
}

/** The database's caps (DB l120): refused past them, never clipped. */
const CORRECTION_NOTE_MAX = 500;
const PRINTED_CARD_NUMBER_MAX = 64;

/**
 * The existing-holder question, on the apply form and on a Correction (DB l120).
 * The number is optional and asked only once the box is ticked; the service
 * drops it if the box is unticked again.
 */
export function PrintedCardQuestion({
  values,
  onChange,
}: {
  values: PrintedCardValues;
  onChange: <K extends keyof PrintedCardValues>(field: K, value: PrintedCardValues[K]) => void;
}) {
  const id = useId();
  return (
    <div style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid #DDDDDD' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: 14, color: '#333333' }}>
        <input
          type="checkbox"
          checked={values.holdsPrintedCard}
          onChange={(e) => onChange('holdsPrintedCard', e.target.checked)}
          style={{ cursor: 'pointer', width: 18, height: 18 }}
        />
        <span>I already hold a printed Yellow Card</span>
      </label>
      {values.holdsPrintedCard && (
        <div className="mb-5" style={{ marginTop: 16 }}>
          <label htmlFor={`${id}-printed-card-number`} className="block text-sm font-semibold text-text-dark mb-2">
            Printed card number (optional)
          </label>
          <input
            id={`${id}-printed-card-number`}
            className={INPUT_CLASS}
            style={INPUT_STYLE}
            placeholder="The number on your printed card"
            value={values.printedCardNumber}
            onChange={(e) => onChange('printedCardNumber', e.target.value)}
            maxLength={PRINTED_CARD_NUMBER_MAX}
          />
        </div>
      )}
    </div>
  );
}

/** "What needs correcting?", required on a Correction (ADR 0011). */
export function CorrectionNoteField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="mb-5" style={{ marginBottom: 40 }}>
      <label htmlFor={`${id}-correction-note`} className="block text-sm font-semibold text-text-dark mb-2">
        <Required /> What needs correcting?
      </label>
      <textarea
        id={`${id}-correction-note`}
        className={INPUT_CLASS}
        style={{ ...INPUT_STYLE, minHeight: 96, resize: 'vertical' }}
        placeholder="For example: my last name is misspelled, or I moved to another barangay."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={CORRECTION_NOTE_MAX}
        required
      />
    </div>
  );
}
