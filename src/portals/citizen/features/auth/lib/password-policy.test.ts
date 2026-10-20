import { describe, it, expect } from 'vitest';
import { validatePassword, PASSWORD_RULES_TEXT } from '@/portals/citizen/features/auth/lib/password-policy';

describe('validatePassword', () => {
  it('accepts a compliant password', () => {
    expect(validatePassword('lucena2026portal')).toBeNull();
  });
  it('rejects short passwords', () => {
    expect(validatePassword('a1b2c3d')).toMatch(/8 characters/);
  });
  it('rejects passwords with no letter', () => {
    expect(validatePassword('1234567890')).toMatch(/letter/);
  });
  it('rejects passwords with no number', () => {
    expect(validatePassword('luzonquezon')).toMatch(/number/);
  });
  it('rejects passwords over 72 characters', () => {
    expect(validatePassword('a1'.repeat(40))).toMatch(/72/);
  });
  it('exposes rules copy matching what it enforces', () => {
    expect(PASSWORD_RULES_TEXT).toBe('At least 8 characters, with at least one letter and one number.');
  });
});
