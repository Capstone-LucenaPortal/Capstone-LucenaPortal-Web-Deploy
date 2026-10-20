import type { CSSProperties } from 'react';
import { NO_DATE, formatManilaDate } from '@/shared/dates/manila';

/**
 * Shared button/field styling for the dashboard's self-service actions.
 *
 * Kept in one module because these controls appear on three different card
 * types and must read as one system: a citizen who learns that the outlined
 * grey button is the cautious choice on an incident card should find the same
 * thing true on a booking card.
 */

export const actionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 12,
};

export function primaryAction(color: string, disabled = false): CSSProperties {
  return {
    background: disabled ? '#9CA3AF' : color,
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

export function secondaryAction(disabled = false): CSSProperties {
  return {
    background: 'white',
    // #666666 rather than the #999 used elsewhere on this page: grey-on-white
    // at #999 fails WCAG AA, and a cautious action must still be readable.
    color: '#666666',
    border: '1px solid #B0B0B0',
    padding: '10px 20px',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

export const reasonTextarea: CSSProperties = {
  width: '100%',
  minHeight: 72,
  padding: '10px 12px',
  border: '1px solid #B0B0B0',
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'inherit',
  resize: 'vertical',
};

export const inlineError: CSSProperties = {
  fontSize: 13,
  color: '#B91C1C',
  background: '#FEF2F2',
  border: '1px solid #FECACA',
  borderRadius: 6,
  padding: '8px 12px',
  marginTop: 10,
};

export const inlineNotice: CSSProperties = {
  fontSize: 13,
  color: '#374151',
  background: '#F3F4F6',
  border: '1px solid #D1D5DB',
  borderRadius: 6,
  padding: '10px 12px',
  marginTop: 10,
  lineHeight: 1.5,
};

export const deadlineNote: CSSProperties = {
  fontSize: 12,
  color: '#666666',
  marginTop: 8,
};

/** A deadline the citizen has to act before, as a Manila date; '' when there is none. */
export function formatDeadline(iso: string | null | undefined): string {
  const text = formatManilaDate(iso);
  return text === NO_DATE ? '' : text;
}

/**
 * Pure: the deadline `days` after `startIso`, as an ISO string, or null when
 * either input is missing or unparseable.
 *
 * The DB's sweeper works in whole days from `submitted_at` / `resolved_at`, so
 * this mirrors that rather than inventing an hour-precise countdown the server
 * would not honour.
 */
export function addDays(startIso: string | null | undefined, days: number | null | undefined): string | null {
  if (!startIso || days == null) return null;
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
