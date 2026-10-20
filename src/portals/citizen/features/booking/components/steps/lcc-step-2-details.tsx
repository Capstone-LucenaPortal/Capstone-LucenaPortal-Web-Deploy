'use client';

import { useEffect, useState } from 'react';
import type { BookingFormData } from '@/portals/citizen/features/booking/types';
import { VENUE_DESCRIPTIONS, formatPHP } from '@/portals/citizen/features/booking/lib/schedule';
import { PhoneInput } from '@/portals/citizen/components/ui/phone-input';
import { catalogService, type CatalogOption, type BookingVenueDetail, type BookingRehearsalRate } from '@/portals/citizen/lib/supabase/catalogs';
import { LIMITS, boundedInt } from '@/portals/citizen/lib/validation';

interface Props {
  bookingData: BookingFormData;
  onUpdate: (fields: Partial<BookingFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface VenueOptionProps {
  venue: BookingVenueDetail;
  isSelected: boolean;
  onSelect: (code: string) => void;
}

function VenueOption({ venue, isSelected, onSelect }: VenueOptionProps) {
  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={() => onSelect(venue.code)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(venue.code);
        }
      }}
      style={{
        padding: '16px',
        borderRadius: 10,
        border: `2px solid ${isSelected ? '#003DA5' : '#eee'}`,
        background: isSelected ? 'rgba(0, 61, 165, 0.02)' : 'white',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        transition: 'all 0.2s ease',
      }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#333333' }}>{venue.label}</div>
        {venue.capacity_label && (
          <div style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>Capacity: {venue.capacity_label}</div>
        )}
      </div>
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: `2px solid ${isSelected ? '#003DA5' : '#d1d5db'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#003DA5' }} />}
      </div>
    </div>
  );
}

export default function LCCStep2Details({ bookingData, onUpdate, onNext, onBack }: Props) {
  const {
    eventTitle,
    eventTypeCode,
    headcount,
    venueCode,
    venueIsHourly,
    practiceRateType,
    organizationName,
    contactPerson,
    contactNumber,
    emailAddress,
    specialRequirements,
  } = bookingData;

  const [venues, setVenues] = useState<BookingVenueDetail[]>([]);
  const [eventTypes, setEventTypes] = useState<CatalogOption[]>([]);
  const [rehearsalRates, setRehearsalRates] = useState<BookingRehearsalRate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      catalogService.getBookingVenueDetails().catch(() => []),
      catalogService.getBookingEventTypes().catch(() => []),
      catalogService.getRehearsalRates().catch(() => []),
    ]).then(([v, e, r]) => {
      setVenues([...v].sort((a, b) => a.sort_order - b.sort_order));
      setEventTypes(e);
      setRehearsalRates(r);
      setLoading(false);
    });
  }, []);

  // Keep the selected rate type on a code the catalog actually offers. Without
  // this, a booking form restored from an earlier session (or one whose default
  // literal the city has since retired) submits a code that no longer FKs, and
  // the citizen meets a 23503 at the very end of the wizard.
  //
  // Only for an hourly venue: every other venue carries '' on purpose, and
  // "correcting" that to a rehearsal code priced Atrium at the rehearsal
  // hourly rate and stored a stray rehearsal_rate_type (SCRUM-187).
  useEffect(() => {
    if (!venueIsHourly || rehearsalRates.length === 0) return;
    if (!rehearsalRates.some((r) => r.code === practiceRateType)) {
      onUpdate({ practiceRateType: rehearsalRates[0].code });
    }
    // `onUpdate` is recreated per render by the orchestrator; depending on it
    // would loop. The rate list and the current selection are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueIsHourly, rehearsalRates, practiceRateType]);

  const handleVenueSelect = (code: string) => {
    const venue = venues.find((v) => v.code === code);
    onUpdate({
      venueCode: code,
      venueLabel: venue?.label ?? '',
      venueIsHourly: !!venue?.is_hourly,
      practiceRateType: venue?.is_hourly ? practiceRateType || 'no_ac_day' : '',
    });
  };

  const standardVenues = venues.filter((v) => !v.is_hourly);
  const hourlyVenues = venues.filter((v) => v.is_hourly);
  const selectedVenue = venues.find((v) => v.code === venueCode) ?? null;

  const canProceed =
    !!eventTitle &&
    !!eventTypeCode &&
    boundedInt(headcount, 1, 5000) !== null &&
    !!venueCode &&
    !!contactPerson &&
    !!contactNumber &&
    !!emailAddress &&
    (selectedVenue?.is_hourly ? !!practiceRateType : true);

  return (
    <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 32, alignItems: 'start' }}>
      {/* Left Column */}
      <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#003DA5', marginBottom: 24 }}>Step 2: Event Details &amp; Venue</h2>

        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#666666', textTransform: 'uppercase', marginBottom: 16 }}>
            Event Information
          </h3>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="booking-event-title" className="block text-sm font-semibold text-[#333333]" style={{ display: 'block', marginBottom: 8 }}>Event Title</label>
            <input
              id="booking-event-title"
              className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-[#333333] font-sans transition-all focus:outline-none focus:border-[#003DA5]"
              style={{ padding: '12px 16px' }}
              placeholder="e.g. 25th Wedding Anniversary"
              value={eventTitle}
              onChange={(e) => onUpdate({ eventTitle: e.target.value })}
              maxLength={LIMITS.shortText}
            />
          </div>
          <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="booking-event-type" className="block text-sm font-semibold text-[#333333]" style={{ display: 'block', marginBottom: 8 }}>Event Type</label>
              <select
                id="booking-event-type"
                className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-[#333333] font-sans transition-all focus:outline-none focus:border-[#003DA5]"
                style={{ padding: '12px 16px' }}
                value={eventTypeCode}
                onChange={(e) => onUpdate({ eventTypeCode: e.target.value })}
              >
                <option value="">Select type</option>
                {eventTypes.map((t) => (
                  <option key={t.code} value={t.code}>{t.label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="booking-headcount" className="block text-sm font-semibold text-[#333333]" style={{ display: 'block', marginBottom: 8 }}>Estimated Headcount</label>
              <input
                id="booking-headcount"
                className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-[#333333] font-sans transition-all focus:outline-none focus:border-[#003DA5]"
                style={{ padding: '12px 16px' }}
                type="number"
                placeholder="0"
                min={1}
                max={5000}
                value={headcount}
                onChange={(e) => onUpdate({ headcount: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#666666', textTransform: 'uppercase', marginBottom: 16 }}>
            Contact Information
          </h3>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="booking-organization-name" className="block text-sm font-semibold text-[#333333]" style={{ display: 'block', marginBottom: 8 }}>Organization Name (optional)</label>
            <input
              id="booking-organization-name"
              className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-[#333333] font-sans transition-all focus:outline-none focus:border-[#003DA5]"
              style={{ padding: '12px 16px' }}
              placeholder="Enter Org/Company Name"
              value={organizationName}
              onChange={(e) => onUpdate({ organizationName: e.target.value })}
              maxLength={LIMITS.orgName}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="booking-contact-person" className="block text-sm font-semibold text-[#333333]" style={{ display: 'block', marginBottom: 8 }}>Contact Person</label>
            <input
              id="booking-contact-person"
              className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-[#333333] font-sans transition-all focus:outline-none focus:border-[#003DA5]"
              style={{ padding: '12px 16px' }}
              placeholder="Full Name"
              value={contactPerson}
              onChange={(e) => onUpdate({ contactPerson: e.target.value })}
              maxLength={LIMITS.name}
            />
          </div>
          <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="booking-contact-number" className="block text-sm font-semibold text-[#333333]" style={{ display: 'block', marginBottom: 8 }}>Contact Number</label>
              <PhoneInput
                id="booking-contact-number"
                className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-[#333333] font-sans transition-all focus:outline-none focus:border-[#003DA5]"
                inputStyle={{ padding: '12px 16px' }}
                value={contactNumber}
                onChange={(v) => onUpdate({ contactNumber: v })}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="booking-email-address" className="block text-sm font-semibold text-[#333333]" style={{ display: 'block', marginBottom: 8 }}>Email Address</label>
              <input
                id="booking-email-address"
                className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-[#333333] font-sans transition-all focus:outline-none focus:border-[#003DA5]"
                style={{ padding: '12px 16px' }}
                type="email"
                placeholder="email@example.com"
                value={emailAddress}
                onChange={(e) => onUpdate({ emailAddress: e.target.value })}
                maxLength={LIMITS.email}
              />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#666666', textTransform: 'uppercase', marginBottom: 16 }}>
            Select Your Venue
          </h3>

          {loading ? (
            <p style={{ color: '#666666', fontSize: 13 }}>Loading venues…</p>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'grid', gap: 12 }}>
                  {standardVenues.map((v) => (
                    <VenueOption key={v.code} venue={v} isSelected={venueCode === v.code} onSelect={handleVenueSelect} />
                  ))}
                </div>
              </div>
              {hourlyVenues.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#9333ea', textTransform: 'uppercase', marginBottom: 12 }}>
                    Rehearsal &amp; Practice
                  </p>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {hourlyVenues.map((v) => (
                      <VenueOption key={v.code} venue={v} isSelected={venueCode === v.code} onSelect={handleVenueSelect} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {selectedVenue?.is_hourly && (
            <div style={{ marginTop: 16, padding: 16, background: '#faf5ff', borderRadius: 12, border: '1px solid #e9d5ff' }}>
              <label
                htmlFor="booking-practice-rate"
                className="block text-sm font-semibold"
                style={{ display: 'block', marginBottom: 8, color: '#7e22ce', fontSize: 12, fontWeight: 700 }}
              >
                PRACTICE MODE OPTION
              </label>
              {/* Driven by public_booking_rehearsal_rates, which since DB layer
                  l55 is the authoritative FK source for this value. The three
                  options here used to be hardcoded literals, so a rate the city
                  added, renamed or retired never reached the citizen — and the
                  price was invisible entirely, because l55 also nulled
                  hourly_rate on both rehearsal_practice venue-rate rows. */}
              <select
                id="booking-practice-rate"
                className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-[#333333] font-sans transition-all focus:outline-none focus:border-[#003DA5]"
                style={{ padding: '12px 16px', borderColor: '#d8b4fe' }}
                value={practiceRateType}
                onChange={(e) => onUpdate({ practiceRateType: e.target.value })}
              >
                {rehearsalRates.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label} — {formatPHP(r.hourly_rate)}/hour
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ marginTop: 32, marginBottom: 20 }}>
          <label htmlFor="booking-special-requirements" className="block text-sm font-semibold text-[#333333]" style={{ display: 'block', marginBottom: 8 }}>Special Requirements / Notes</label>
          <textarea
            id="booking-special-requirements"
            className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-[#333333] font-sans transition-all focus:outline-none focus:border-[#003DA5]"
            style={{ padding: '12px 16px' }}
            rows={3}
            placeholder="Need extra chairs, specific stage setup, etc."
            value={specialRequirements}
            onChange={(e) => onUpdate({ specialRequirements: e.target.value })}
            maxLength={LIMITS.description}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
          <button
            className="inline-flex items-center justify-center bg-transparent border border-[#003DA5] text-[#003DA5] rounded font-semibold cursor-pointer transition-all"
            onClick={onBack}
            style={{ flex: 1, padding: 12 }}
          >
            Back
          </button>
          <button
            className="inline-flex items-center justify-center bg-[#003DA5] text-white border-none rounded font-semibold cursor-pointer transition-all"
            onClick={onNext}
            disabled={!canProceed}
            style={{ flex: 1, padding: 12, background: canProceed ? '#003DA5' : '#ccc' }}
          >
            Continue to Schedule
          </button>
        </div>
      </div>

      {/* Right Column: Venue Info Card */}
      <div className="stack-mobile-sidebar" style={{ position: 'sticky', top: 24 }}>
        <div
          className="bg-white border border-[#DDDDDD] rounded shadow-sm"
          style={{ border: '2px solid #003DA5', background: 'white', padding: '24px 32px' }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#003DA5',
              textTransform: 'uppercase',
              marginBottom: 20,
              borderBottom: '1px solid #eee',
              paddingBottom: 12,
            }}
          >
            Venue Preview
          </h3>
          {selectedVenue ? (
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#333333', marginBottom: 4 }}>{selectedVenue.label}</div>
              {selectedVenue.capacity_label && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#003DA5', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
                  <span>Capacity: {selectedVenue.capacity_label}</span>
                </div>
              )}
              <p style={{ fontSize: 13, color: '#666666', lineHeight: 1.6 }}>
                {VENUE_DESCRIPTIONS[selectedVenue.code] ?? ''}
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#666666' }}>Select a venue to see details here.</p>
          )}
        </div>
        <div
          className="bg-white border border-[#DDDDDD] rounded shadow-sm"
          style={{ marginTop: 16, background: 'rgba(0, 61, 165, 0.02)', border: '1px dashed #003DA5', padding: '24px 32px' }}
        >
          <h4 style={{ fontSize: 13, fontWeight: 700, color: '#003DA5', marginBottom: 8 }}>Included Amenities</h4>
          <ul style={{ fontSize: 12, color: '#666666', paddingLeft: 16, lineHeight: 1.6 }}>
            <li>Standard Sound System</li>
            <li>Basic Stage Lighting</li>
            <li>Air Conditioning (Main Event)</li>
            <li>Security &amp; Janitorial Staff</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
