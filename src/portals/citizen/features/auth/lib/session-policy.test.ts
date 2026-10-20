import { describe, it, expect } from 'vitest';
import {
  IDLE_TIMEOUT_MS,
  isIdleExpired,
  recoveryFlagState,
} from '@/portals/citizen/features/auth/lib/session-policy';

const TTL = 30 * 60 * 1000;
const NOW = 1_800_000_000_000;

describe('recoveryFlagState', () => {
  it('reports a fresh flag as active', () => {
    expect(recoveryFlagState(String(NOW - 1000), NOW, TTL)).toBe('active');
  });

  it('reports no flag as none', () => {
    expect(recoveryFlagState(null, NOW, TTL)).toBe('none');
    expect(recoveryFlagState('', NOW, TTL)).toBe('none');
  });

  // The whole point of the fix. An aged-out flag must not read the same as
  // "no recovery in progress": the Supabase session underneath is still a
  // valid, auto-refreshing token pair for a user who never set a password, so
  // treating it as 'none' silently promoted it to a full citizen session.
  it('reports an aged-out flag as expired, never as none', () => {
    const state = recoveryFlagState(String(NOW - TTL - 1), NOW, TTL);
    expect(state).toBe('expired');
    expect(state).not.toBe('none');
  });

  it('treats the exact TTL boundary as still active', () => {
    expect(recoveryFlagState(String(NOW - TTL), NOW, TTL)).toBe('active');
  });

  // A tampered or corrupt flag cannot be aged, and a recovery session is never
  // given the benefit of the doubt.
  it('treats an unparseable flag as expired', () => {
    expect(recoveryFlagState('not-a-number', NOW, TTL)).toBe('expired');
    expect(recoveryFlagState('0', NOW, TTL)).toBe('expired');
    expect(recoveryFlagState('-5', NOW, TTL)).toBe('expired');
  });
});

describe('isIdleExpired', () => {
  it('is false while the session is inside the idle window', () => {
    expect(isIdleExpired(String(NOW - 1000), NOW)).toBe(false);
    expect(isIdleExpired(String(NOW - IDLE_TIMEOUT_MS), NOW)).toBe(false);
  });

  it('is true once the idle window has elapsed', () => {
    expect(isIdleExpired(String(NOW - IDLE_TIMEOUT_MS - 1), NOW)).toBe(true);
  });

  // Fails open on purpose: the alternative signs out every citizen whose
  // session predates this key existing, and the absolute backstop is the
  // Supabase refresh-token expiry, not this clock.
  it('is false when no timestamp has been recorded yet', () => {
    expect(isIdleExpired(null, NOW)).toBe(false);
    expect(isIdleExpired('', NOW)).toBe(false);
    expect(isIdleExpired('not-a-number', NOW)).toBe(false);
  });

  // A backwards clock jump would otherwise yield a negative age that can never
  // exceed the cap, quietly disabling the timeout for the rest of the session.
  it('is false when the recorded time is in the future', () => {
    expect(isIdleExpired(String(NOW + 60_000), NOW)).toBe(false);
  });
});
