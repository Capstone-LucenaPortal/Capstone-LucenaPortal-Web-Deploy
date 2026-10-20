import { describe, it, expect } from 'vitest';
import { LIMITS, fieldTooLong, emailError, phMobileError, boundedInt, birthDateError } from '@/portals/citizen/lib/validation';

describe('validation primitives', () => {
  it('fieldTooLong flags values over the cap and passes values at it', () => {
    expect(fieldTooLong('Description', 'a'.repeat(LIMITS.description), LIMITS.description)).toBeNull();
    expect(fieldTooLong('Description', 'a'.repeat(LIMITS.description + 1), LIMITS.description)).toMatch(/Description/);
  });
  it('emailError accepts normal addresses and rejects junk and oversize', () => {
    expect(emailError('juan.delacruz@example.ph')).toBeNull();
    expect(emailError('not-an-email')).not.toBeNull();
    expect(emailError('a@' + 'b'.repeat(260) + '.com')).not.toBeNull();
  });
  it('phMobileError enforces the 09XXXXXXXXX shape', () => {
    expect(phMobileError('09171234567')).toBeNull();
    expect(phMobileError('9171234567')).not.toBeNull();
    expect(phMobileError('091712345678')).not.toBeNull();
    expect(phMobileError('0917abc4567')).not.toBeNull();
  });
  it('boundedInt returns null for NaN, floats, and out-of-range', () => {
    expect(boundedInt('250', 1, 5000)).toBe(250);
    expect(boundedInt('0', 1, 5000)).toBeNull();
    expect(boundedInt('-5', 1, 5000)).toBeNull();
    expect(boundedInt('2.5', 1, 5000)).toBeNull();
    expect(boundedInt('abc', 1, 5000)).toBeNull();
  });
  it('boundedInt rejects blank/whitespace-only strings even when min <= 0', () => {
    expect(boundedInt('', 0, 120)).toBeNull();
    expect(boundedInt('  ', 0, 120)).toBeNull();
  });
  it('birthDateError rejects future, ancient, invalid, and under-age dates', () => {
    expect(birthDateError('1990-06-15')).toBeNull();
    expect(birthDateError('2999-01-01')).not.toBeNull();
    expect(birthDateError('1850-01-01')).not.toBeNull();
    expect(birthDateError('not-a-date')).not.toBeNull();
    expect(birthDateError('2020-01-01', { minAgeYears: 18 })).toMatch(/18/);
  });
});
