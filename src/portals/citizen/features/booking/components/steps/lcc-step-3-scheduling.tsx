'use client';

import { useEffect, useState } from 'react';
import type { BookingFormData, DayStatus } from '@/portals/citizen/features/booking/types';
import { toDateStr, formatHour, occupiedHourRange, computeDayStatus, hasTimeConflict } from '@/portals/citizen/features/booking/lib/schedule';
import type { VenueAvailability } from '@/portals/citizen/features/booking/types';
import { bookingService } from '@/portals/citizen/features/booking/lib/booking';
import { catalogService, type BookingConfig } from '@/portals/citizen/lib/supabase/catalogs';

interface Props {
  bookingData: BookingFormData;
  onUpdate: (fields: Partial<BookingFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
// Frontend-only sensible cap — the backend has no maximum duration beyond the closing hour.
const MAX_DURATION_HOURS = 16;

export default function LCCStep3Scheduling({ bookingData, onUpdate, onNext, onBack }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const { selectedDate, startTime, durationHours, venueCode, venueIsHourly } = bookingData;

  const [availability, setAvailability] = useState<VenueAvailability[]>([]);
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      bookingService.getVenueAvailability().catch(() => []),
      catalogService.getBookingConfig().catch(() => null),
    ]).then(([a, c]) => {
      setAvailability(a);
      setConfig(c);
      setLoading(false);
    });
  }, []);

  const openingHour = config?.opening_hour ?? 6;
  const closingHour = config?.closing_hour ?? 22;
  const minDuration = venueIsHourly ? 1 : config?.min_duration_hours ?? 6;

  function occupiedRangesFor(date: Date): Array<{ startHour: number; endHour: number }> {
    const ds = toDateStr(date);
    return availability
      .filter((row) => row.venue_code === venueCode && row.event_date === ds)
      .map((row) => occupiedHourRange(row.during))
      .filter((r): r is { startHour: number; endHour: number } => r !== null);
  }

  function getDayStatus(date: Date): DayStatus {
    return computeDayStatus(occupiedRangesFor(date), openingHour, closingHour);
  }

  function getCalendarDays(): (Date | null)[] {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const days: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(viewYear, viewMonth, d));
    }
    return days;
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }
  function selectDay(day: Date | null) {
    if (!day) return;
    const isPast = day < today;
    if (isPast || getDayStatus(day) === 'fully-booked') return;
    onUpdate({ selectedDate: day, startTime: '', durationHours: minDuration });
  }

  const startHour = startTime ? parseInt(startTime.split(':')[0], 10) : null;

  // A longer booking can push the chosen start past closing; it then drops out of the
  // dropdown, so clear it too rather than keep a value the box no longer shows.
  function increaseDuration() {
    const next = Math.min(MAX_DURATION_HOURS, Number(durationHours) + 1);
    const endsAfterClosing = startHour !== null && startHour + next > closingHour;
    onUpdate(endsAfterClosing ? { durationHours: next, startTime: '' } : { durationHours: next });
  }

  const endHour = startHour !== null ? startHour + Number(durationHours) : null;
  const startHourCandidates = Array.from({ length: Math.max(0, closingHour - openingHour) }, (_, i) => i + openingHour);
  const validStartHours = startHourCandidates.filter((h) => h + Number(durationHours) <= closingHour);
  const conflict =
    selectedDate && startHour !== null
      ? hasTimeConflict(occupiedRangesFor(selectedDate as Date), startHour, Number(durationHours))
      : false;
  const canProceed =
    !!selectedDate &&
    !!startTime &&
    Number(durationHours) >= minDuration &&
    endHour !== null &&
    endHour <= closingHour &&
    !conflict;
  const days = getCalendarDays();

  if (loading) {
    return (
      <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '48px 32px', textAlign: 'center' }}>
        <p style={{ color: '#666666' }}>Loading availability…</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#003DA5', marginBottom: 8 }}>Step 3: Scheduling</h2>
      <p style={{ color: '#666666', marginBottom: 24, fontSize: 14 }}>Select your preferred date and time block.</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          style={{ background: 'none', border: '1px solid #ddd', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 16 }}
        >
          ‹
        </button>
        <strong style={{ fontSize: 16 }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </strong>
        <button
          onClick={nextMonth}
          aria-label="Next month"
          style={{ background: 'none', border: '1px solid #ddd', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 16 }}
        >
          ›
        </button>
      </div>

      <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32 }}>
        <div style={{ maxWidth: 420 }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 11 }}>
            {[
              { color: '#fff', border: '#ddd', label: 'Available' },
              { color: '#fef3c7', border: '#d97706', label: 'Partial' },
              { color: '#fee2e2', border: '#dc2626', label: 'Full' },
            ].map((s) => (
              <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    background: s.color,
                    border: `1px solid ${s.border}`,
                    display: 'inline-block',
                  }}
                />
                {s.label}
              </span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {DAY_LABELS.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#666666', padding: '6px 0' }}>
                {d}
              </div>
            ))}
            {days.map((day, idx) => {
              if (!day) return <div key={`pad-${idx}`} />;
              const isPast = day < today;
              const status = getDayStatus(day);
              const selected = selectedDate && toDateStr(day) === toDateStr(selectedDate as Date);
              let bg = '#fff',
                border = '#e5e7eb',
                color = '#111',
                cursor = 'pointer';
              if (isPast) {
                bg = '#f9fafb';
                color = '#9ca3af';
                cursor = 'default';
                border = '#e5e7eb';
              } else if (status === 'fully-booked') {
                bg = '#fee2e2';
                border = '#dc2626';
                color = '#9ca3af';
                cursor = 'not-allowed';
              } else if (status === 'partial') {
                bg = '#fef3c7';
                border = '#d97706';
              }
              if (selected) {
                bg = '#003DA5';
                border = '#003DA5';
                color = '#fff';
              }
              const isSelectable = !isPast && status !== 'fully-booked';
              return (
                <div
                  key={toDateStr(day)}
                  role="button"
                  aria-label={day.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                  aria-disabled={!isSelectable}
                  tabIndex={isSelectable ? 0 : -1}
                  onClick={() => selectDay(day)}
                  onKeyDown={(e) => {
                    if (isSelectable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      selectDay(day);
                    }
                  }}
                  style={{
                    textAlign: 'center',
                    padding: '12px 4px',
                    borderRadius: 6,
                    border: `1px solid ${border}`,
                    background: bg,
                    color,
                    cursor,
                    fontSize: 13,
                    fontWeight: selected ? 700 : 400,
                  }}
                >
                  {day.getDate()}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          {selectedDate ? (
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 20, border: '1px solid #E2E8F0' }}>
              <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#003DA5' }}>
                {(selectedDate as Date).toLocaleDateString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h4>
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="booking-start-time" className="block text-sm font-semibold text-[#333333]" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                  Start Time
                </label>
                <select
                  id="booking-start-time"
                  className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-[#333333] font-sans transition-all focus:outline-none focus:border-[#003DA5]"
                  style={{ padding: '12px 16px' }}
                  value={startTime}
                  onChange={(e) => onUpdate({ startTime: e.target.value })}
                >
                  <option value="">Select...</option>
                  {validStartHours.map((h) => (
                    <option key={h} value={`${String(h).padStart(2, '0')}:00`}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className="block text-sm font-semibold text-[#333333]" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                  Duration (min {minDuration}h)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => onUpdate({ durationHours: Math.max(minDuration, Number(durationHours) - 1) })}
                    disabled={Number(durationHours) <= minDuration}
                    style={{
                      width: 36, height: 36, borderRadius: 4, border: '1px solid #CCCCCC',
                      background: Number(durationHours) <= minDuration ? '#F5F5F5' : 'white',
                      color: Number(durationHours) <= minDuration ? '#CCCCCC' : '#333333',
                      cursor: Number(durationHours) <= minDuration ? 'not-allowed' : 'pointer',
                      fontSize: 20, fontWeight: 700, lineHeight: 1, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    −
                  </button>
                  <span style={{ fontSize: 18, fontWeight: 700, minWidth: 40, textAlign: 'center', color: '#333333' }}>
                    {durationHours}
                  </span>
                  <button
                    type="button"
                    onClick={increaseDuration}
                    disabled={Number(durationHours) >= MAX_DURATION_HOURS}
                    style={{
                      width: 36, height: 36, borderRadius: 4, border: '1px solid #CCCCCC',
                      background: Number(durationHours) >= MAX_DURATION_HOURS ? '#F5F5F5' : 'white',
                      color: Number(durationHours) >= MAX_DURATION_HOURS ? '#CCCCCC' : '#333333',
                      cursor: Number(durationHours) >= MAX_DURATION_HOURS ? 'not-allowed' : 'pointer',
                      fontSize: 20, fontWeight: 700, lineHeight: 1, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    +
                  </button>
                  <span style={{ fontSize: 12, color: '#666666', whiteSpace: 'nowrap' }}>hours total</span>
                </div>
              </div>
              {startTime && endHour && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                    <span style={{ color: '#666666' }}>End Time:</span>
                    <span style={{ fontWeight: 700 }}>{formatHour(endHour)}</span>
                  </div>
                  {conflict && (
                    <div style={{ fontSize: 12, color: '#991B1B', fontWeight: 600, marginTop: 8 }}>
                      ⚠️ This time overlaps an existing booking. Please choose a different start time.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#F9FAFB',
                borderRadius: 12,
                border: '2px dashed #E5E7EB',
                padding: 20,
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: 13, color: '#666666' }}>
                Please select a date from the calendar to choose your time slot.
              </p>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
        <button
          className="inline-flex items-center justify-center bg-transparent border border-[#003DA5] text-[#003DA5] rounded font-semibold cursor-pointer transition-all"
          onClick={onBack}
          style={{ flex: 1, padding: 14 }}
        >
          Back
        </button>
        <button
          className="inline-flex items-center justify-center bg-[#003DA5] text-white border-none rounded font-semibold cursor-pointer transition-all"
          onClick={onNext}
          disabled={!canProceed}
          style={{
            flex: 2,
            padding: 14,
            fontSize: 15,
            fontWeight: 700,
            background: canProceed ? '#003DA5' : '#CCCCCC',
            cursor: canProceed ? 'pointer' : 'not-allowed',
          }}
        >
          Review Booking Summary →
        </button>
      </div>
    </div>
  );
}
