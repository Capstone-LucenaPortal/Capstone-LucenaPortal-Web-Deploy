// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  resetPasswordView,
  type ResetPasswordInput,
} from '@/portals/citizen/features/auth/lib/reset-password-view';

/** A settled recovery session, opened from the reset link: the happy path. */
const RECOVERY: ResetPasswordInput = {
  loading: false,
  hasUser: true,
  isPasswordRecovery: true,
  passwordUpdated: false,
  cancelling: false,
  openedFromResetLink: true,
};

describe('resetPasswordView', () => {
  it('shows the form to a recovery session', () => {
    expect(resetPasswordView(RECOVERY)).toEqual({ state: 'form', redirectToSecurity: false });
  });

  // The reset link's recovery session is established while auth bootstraps;
  // deciding before then would flash "link unusable" at a genuine reset.
  it('waits while auth is still loading', () => {
    expect(resetPasswordView({ ...RECOVERY, loading: true, hasUser: false, isPasswordRecovery: false })).toEqual({
      state: 'waiting',
      redirectToSecurity: false,
    });
  });

  // A reset link opened in a browser without the PKCE code verifier settles
  // with no session at all; the form could only fail on submit.
  it.each([true, false])('calls the link unusable once auth settles with no user (opened from link: %s)', (openedFromResetLink) => {
    expect(
      resetPasswordView({ ...RECOVERY, hasUser: false, isPasswordRecovery: false, openedFromResetLink }),
    ).toEqual({ state: 'linkUnusable', redirectToSecurity: false });
  });

  // Issue #16: typing the address on an unattended, signed-in browser. That is
  // a password change, which belongs to Profile, where the current password is
  // asked for first.
  it('sends a signed-in citizen without a recovery session to Security & Password', () => {
    expect(resetPasswordView({ ...RECOVERY, isPasswordRecovery: false, openedFromResetLink: false })).toEqual({
      state: 'signedInWithoutRecovery',
      redirectToSecurity: true,
    });
  });

  // supabase-js reports the exchanged session before it fires
  // PASSWORD_RECOVERY, so a page opened from the reset link briefly looks
  // signed in without a recovery session. Redirecting then would throw away a
  // genuine reset; the panel stays up until the recovery session arrives.
  it('does not redirect a page opened from the reset link', () => {
    expect(resetPasswordView({ ...RECOVERY, isPasswordRecovery: false, openedFromResetLink: true })).toEqual({
      state: 'signedInWithoutRecovery',
      redirectToSecurity: false,
    });
  });

  // Updating the password signs the citizen out, which would otherwise read
  // as "link unusable". "Password Updated" outranks every other state.
  it.each<[string, Partial<ResetPasswordInput>]>([
    ['the recovery session is still up', {}],
    ['signed out', { hasUser: false, isPasswordRecovery: false }],
    ['signed in without a recovery session, opened from the reset link', { isPasswordRecovery: false }],
    ['auth is loading', { loading: true }],
  ])('confirms the password was updated while %s', (_, overrides) => {
    expect(resetPasswordView({ ...RECOVERY, passwordUpdated: true, ...overrides })).toEqual({
      state: 'done',
      redirectToSecurity: false,
    });
  });

  // The redirect does not look at "Password Updated": a page reached without
  // the link (a reload strips `code`) that then sees an ordinary session, such
  // as a sign-in from another tab, still goes to Profile, as it always has.
  it('still redirects a non-recovery session after the update when not opened from the reset link', () => {
    expect(
      resetPasswordView({ ...RECOVERY, passwordUpdated: true, isPasswordRecovery: false, openedFromResetLink: false }),
    ).toEqual({ state: 'done', redirectToSecurity: true });
  });

  // Signed-in-without-recovery comes before link-unusable only because the two
  // can't both hold; loading must still outrank a session seen mid-bootstrap.
  it('waits rather than redirecting while auth is loading, even with a non-recovery session', () => {
    expect(
      resetPasswordView({ ...RECOVERY, loading: true, isPasswordRecovery: false, openedFromResetLink: false }),
    ).toEqual({ state: 'waiting', redirectToSecurity: false });
  });

  // Issue #44. Cancelling signs the citizen out before the page navigates
  // home; the signed-out render in between must not read as an unusable link.
  it.each<[string, Partial<ResetPasswordInput>]>([
    ['the recovery session is still up', {}],
    ['signed out', { hasUser: false, isPasswordRecovery: false }],
    ['auth is loading', { loading: true }],
  ])('shows nothing while a cancel is under way and %s', (_, overrides) => {
    expect(resetPasswordView({ ...RECOVERY, cancelling: true, ...overrides })).toEqual({
      state: 'cancelling',
      redirectToSecurity: false,
    });
  });

  it('still confirms a password that was updated before a cancel', () => {
    expect(resetPasswordView({ ...RECOVERY, passwordUpdated: true, cancelling: true })).toEqual({
      state: 'done',
      redirectToSecurity: false,
    });
  });
});
