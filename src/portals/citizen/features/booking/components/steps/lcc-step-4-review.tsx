'use client';

import { useEffect, useState } from 'react';
import type { BookingFormData, FeeEstimate } from '@/portals/citizen/features/booking/types';
import { formatPHP, formatHour, estimateVenueFee, PRACTICE_RATE_TYPE_LABELS } from '@/portals/citizen/features/booking/lib/schedule';
import { catalogService, type BookingVenueRate, type BookingConfig, type BookingRehearsalRate } from '@/portals/citizen/lib/supabase/catalogs';

interface Props {
  bookingData: BookingFormData;
  onUpdate: (fields: Partial<BookingFormData>) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: '#666666' }}>{label}:</span>
      <span style={{ fontWeight: 600, color: '#333333' }}>{value}</span>
    </div>
  );
}

function FeeRow({ label, estimate, isHourly }: { label: string; estimate: FeeEstimate; isHourly: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: '#666666' }}>{label}:</span>
      <span style={{ fontWeight: 600 }}>
        {estimate.requiresQuote
          ? 'Requires a custom quote'
          : estimate.amount != null
          ? `${formatPHP(estimate.amount)}${isHourly ? '/session' : ''}`
          : '—'}
      </span>
    </div>
  );
}

export default function LCCStep4Review({ bookingData, onUpdate, onSubmit, onBack, submitting }: Props) {
  const [termsAccepted, setTermsAccepted] = useState(bookingData.termsAccepted);
  const [rates, setRates] = useState<BookingVenueRate[]>([]);
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [rehearsalRates, setRehearsalRates] = useState<BookingRehearsalRate[]>([]);
  const [loadingRates, setLoadingRates] = useState(true);

  const {
    venueCode,
    venueLabel,
    venueIsHourly,
    practiceRateType,
    durationHours,
    selectedDate,
    startTime,
    eventTitle,
    headcount,
    organizationName,
    contactPerson,
    contactNumber,
    emailAddress,
    specialRequirements,
  } = bookingData;

  useEffect(() => {
    Promise.all([
      catalogService.getBookingVenueRates().catch(() => []),
      catalogService.getBookingConfig().catch(() => null),
      catalogService.getRehearsalRates().catch(() => []),
    ]).then(([r, c, rr]) => {
      setRates(r);
      setConfig(c);
      setRehearsalRates(rr);
      setLoadingRates(false);
    });
  }, []);

  const commercialRate = rates.find((r) => r.venue_code === venueCode && r.tier === 'commercial');
  const discountedRate = rates.find((r) => r.venue_code === venueCode && r.tier === 'discounted');

  // DB layer l55 nulled hourly_rate on both rehearsal_practice rows and moved
  // the figure to public_booking_rehearsal_rates, keyed on the selected rate
  // type and independent of tier. Passing it in is what makes a rehearsal
  // booking show a number at all — before this the null fell through and every
  // rehearsal estimate rendered as an em dash, while the citizen was still
  // asked to accept terms on the undisplayed amount.
  //
  // Hourly venues only: estimateVenueFee checks this before base_fee, so a
  // stray code on Atrium would reprice it by the hour (SCRUM-187).
  const rehearsalHourly = venueIsHourly
    ? rehearsalRates.find((r) => r.code === practiceRateType)?.hourly_rate ?? null
    : null;

  const commercialEstimate = estimateVenueFee(commercialRate, Number(durationHours), rehearsalHourly);
  const discountedEstimate = estimateVenueFee(discountedRate, Number(durationHours), rehearsalHourly);
  const downpaymentPct = config?.downpayment_pct ?? 50;

  const startH = startTime ? parseInt(startTime.split(':')[0], 10) : 0;
  const endH = startH + Number(durationHours);

  return (
    <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#003DA5', marginBottom: 8 }}>Step 4: Review &amp; Submit</h2>
      <p style={{ color: '#666666', marginBottom: 32, fontSize: 14 }}>
        Please review your booking summary below. The exact fee is confirmed once your request is submitted.
      </p>

      <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#333333', marginBottom: 16, textTransform: 'uppercase' }}>
            Booking Details
          </h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <SummaryRow label="Event Title" value={eventTitle} />
            <SummaryRow
              label="Venue"
              value={venueIsHourly && practiceRateType ? `${venueLabel} (${rehearsalRates.find((r) => r.code === practiceRateType)?.label ?? PRACTICE_RATE_TYPE_LABELS[practiceRateType] ?? practiceRateType})` : venueLabel}
            />
            {organizationName && <SummaryRow label="Organization" value={organizationName} />}
            <SummaryRow label="Contact" value={contactPerson} />
            <SummaryRow label="Phone" value={contactNumber} />
            <SummaryRow label="Email" value={emailAddress} />
            <SummaryRow
              label="Date"
              value={(selectedDate as Date | null)?.toLocaleDateString('en-PH', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            />
            <SummaryRow label="Time" value={`${formatHour(startH)} – ${formatHour(endH)}`} />
            <SummaryRow label="Expected" value={`${headcount} pax`} />
          </div>
        </div>

        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, background: '#F8FAFC' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#003DA5', marginBottom: 16, textTransform: 'uppercase' }}>
            Estimated Fee
          </h3>
          {loadingRates ? (
            <p style={{ fontSize: 13, color: '#666666' }}>Loading rates…</p>
          ) : (
            <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
              <FeeRow label="Standard rate" estimate={commercialEstimate} isHourly={venueIsHourly} />
              <FeeRow label="Discounted rate (eligible orgs)" estimate={discountedEstimate} isHourly={venueIsHourly} />
              <p style={{ fontSize: 11, color: '#666666', margin: 0 }}>
                Your actual rate depends on your classification and is confirmed after submission.
              </p>
            </div>
          )}
          <div style={{ background: '#FEF2F2', borderRadius: 8, padding: 12, border: '1px solid #FECACA' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#991B1B' }}>DOWNPAYMENT ({downpaymentPct}%)</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#991B1B' }}>Confirmed after submission</span>
            </div>
          </div>
        </div>
      </div>

      {specialRequirements && (
        <div
          style={{
            marginBottom: 32,
            padding: 16,
            background: '#F9FAFB',
            borderRadius: 8,
            borderLeft: '4px solid #D1D5DB',
          }}
        >
          <h4 style={{ fontSize: 12, fontWeight: 700, color: '#666666', marginBottom: 4, textTransform: 'uppercase' }}>
            Special Requirements
          </h4>
          <p style={{ fontSize: 13, color: '#333333', margin: 0 }}>{specialRequirements}</p>
        </div>
      )}

      <div style={{ marginBottom: 32 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', fontSize: 13, color: '#666666' }}>
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => {
              setTermsAccepted(e.target.checked);
              onUpdate({ termsAccepted: e.target.checked });
            }}
            style={{ marginTop: 2, width: 18, height: 18, cursor: 'pointer' }}
          />
          <span style={{ lineHeight: 1.6 }}>
            I hereby certify that the information provided is true and correct. I have read and agree to the{' '}
            <strong>LCC Booking Terms and Conditions</strong>. I understand my fee will be confirmed after
            submission and that a {downpaymentPct}% downpayment is required to secure the slot.
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          className="inline-flex items-center justify-center bg-transparent border border-[#003DA5] text-[#003DA5] rounded font-semibold cursor-pointer transition-all"
          onClick={onBack}
          style={{ flex: 1, padding: 14 }}
        >
          Back
        </button>
        <button
          className="inline-flex items-center justify-center bg-[#003DA5] text-white border-none rounded font-semibold cursor-pointer transition-all"
          onClick={onSubmit}
          disabled={!termsAccepted || submitting}
          style={{
            flex: 2,
            padding: 14,
            fontSize: 16,
            fontWeight: 700,
            background: termsAccepted && !submitting ? '#003DA5' : '#CCCCCC',
            cursor: termsAccepted && !submitting ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Booking Request'}
        </button>
      </div>
    </div>
  );
}
