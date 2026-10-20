/** Client-side input bounds. UX backstop only — the RPCs are the real
 * validators (see the security spec §6 for the server-side counterpart). */
export const LIMITS = {
  name: 80,
  shortText: 120,
  orgName: 160,
  address: 300,
  description: 2000,
  reference: 40,
  email: 254,
} as const;

export function fieldTooLong(label: string, value: string, max: number): string | null {
  return value.length > max ? `${label} must be ${max} characters or fewer.` : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function emailError(value: string): string | null {
  if (value.length > LIMITS.email || !EMAIL_RE.test(value)) {
    return 'Please enter a valid email address.';
  }
  return null;
}

export function phMobileError(value: string): string | null {
  return /^09\d{9}$/.test(value)
    ? null
    : 'Please enter a valid PH mobile number (09XXXXXXXXX).';
}

export function boundedInt(value: unknown, min: number, max: number): number | null {
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value));
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

export function birthDateError(value: string, opts: { minAgeYears?: number } = {}): string | null {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'Please enter a valid date of birth.';
  const now = new Date();
  if (d > now) return 'Date of birth cannot be in the future.';
  const age = (now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age > 120) return 'Please check the date of birth.';
  if (opts.minAgeYears != null && age < opts.minAgeYears) {
    return `You must be at least ${opts.minAgeYears} years old.`;
  }
  return null;
}
