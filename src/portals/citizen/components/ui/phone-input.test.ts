import { describe, it, expect } from 'vitest';
import { toLocalDigits, fromLocalDigits, formatLocalDigits } from '@/portals/citizen/components/ui/phone-input';

describe('toLocalDigits', () => {
  it('strips a leading local 0', () => {
    expect(toLocalDigits('09171234567')).toBe('9171234567');
  });

  it('leaves an already-bare number unchanged', () => {
    expect(toLocalDigits('9171234567')).toBe('9171234567');
  });

  it('returns empty string for empty input', () => {
    expect(toLocalDigits('')).toBe('');
  });

  it('recognizes a pasted international format with spaces and a plus sign', () => {
    expect(toLocalDigits('+63 917 123 4567')).toBe('9171234567');
  });

  it('recognizes a pasted international format with no spaces or plus sign', () => {
    expect(toLocalDigits('639171234567')).toBe('9171234567');
  });

  it('caps an over-length local input at 10 digits after stripping the leading 0', () => {
    expect(toLocalDigits('0917123456789')).toBe('9171234567');
  });
});

describe('fromLocalDigits', () => {
  it('reconstructs the leading 0', () => {
    expect(fromLocalDigits('9171234567')).toBe('09171234567');
  });

  it('returns empty string for empty input (no dangling "0")', () => {
    expect(fromLocalDigits('')).toBe('');
  });
});

describe('formatLocalDigits', () => {
  it('groups a full 10-digit number as 3-3-4', () => {
    expect(formatLocalDigits('9171234567')).toBe('917 123 4567');
  });

  it('formats a partial number as far as it reaches', () => {
    expect(formatLocalDigits('9')).toBe('9');
    expect(formatLocalDigits('91')).toBe('91');
    expect(formatLocalDigits('917')).toBe('917');
    expect(formatLocalDigits('9171')).toBe('917 1');
    expect(formatLocalDigits('917123')).toBe('917 123');
    expect(formatLocalDigits('9171234')).toBe('917 123 4');
  });

  it('returns empty string for empty input', () => {
    expect(formatLocalDigits('')).toBe('');
  });
});
