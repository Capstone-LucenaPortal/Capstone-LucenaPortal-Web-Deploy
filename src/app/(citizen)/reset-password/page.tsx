'use client';

import { useState } from 'react';
import { PasswordVisibilityToggle } from '@/shared/auth/password-visibility-toggle';
import { useRouter } from 'next/navigation';
import { authService, RESET_LINK_UNUSABLE_MESSAGE } from '@/portals/citizen/features/auth/lib/auth';
import { validatePassword, PASSWORD_RULES_TEXT } from '@/shared/auth/password-policy';
import { useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';
import { useResetPasswordState } from '@/portals/citizen/features/auth/hooks/use-reset-password-state';
import { useCancelPasswordReset } from '@/portals/citizen/features/auth/hooks/use-cancel-password-reset';
import { usePasswordUpdateInFlight, useTrackPasswordUpdate } from '@/portals/citizen/features/auth/hooks/use-password-update-in-flight';
import { PROFILE_TAB_SECURITY, profileTabHref } from '@/portals/citizen/features/profile/lib/tabs';

const inputClass = 'w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-text-dark font-sans transition-all focus:outline-none focus:border-lucena-blue focus:shadow-[0_0_0_3px_rgba(0,61,165,0.1)]';
const labelClass = 'block text-xs font-semibold text-[#666666] uppercase tracking-[0.03em]';
export default function ResetPasswordPage() {
  const router = useRouter();
  const { logout, openAuthModal } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPasswords, setShowPasswords] = useState({ new: false, confirm: false });
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [error, setError] = useState('');
  // Shared with the reset-mode navbar, whose "Sign out" is off while it's on.
  const saving = usePasswordUpdateInFlight();
  const trackUpdate = useTrackPasswordUpdate();
  const state = useResetPasswordState(passwordUpdated);
  const cancelReset = useCancelPasswordReset();

  const submit = async () => {
    if (saving) return;
    setError('');
    const policyError = validatePassword(password);
    if (policyError) { setError(policyError); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    await trackUpdate(async () => {
      try {
        await authService.updatePassword(password); // uses the recovery session from the email link
        // That recovery session's only job was letting them set a new password.
        // End it here rather than silently carrying them into a signed-in state
        // — they must prove the new password by signing in with it, same as
        // completing a reset anywhere else.
        await logout();
        setPasswordUpdated(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update the password.');
      }
    });
  };

  const goSignIn = () => {
    openAuthModal('login');
    router.push('/');
  };

  const goSecurity = () => router.push(profileTabHref(PROFILE_TAB_SECURITY));

  const requestNewLink = () => {
    openAuthModal('forgot');
    router.push('/');
  };

  return (
    <section className="page-section" style={{ padding: '64px clamp(20px, 5vw, 48px) 100px', maxWidth: 460, margin: '0 auto' }}>
      <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: 32 }}>
        {state === 'done' ? (
          <>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#003DA5', textAlign: 'center', marginBottom: 8 }}>Password Updated</h1>
            <p style={{ fontSize: 14, color: '#666666', textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>
              Your password has been changed. For your security, you&apos;ve been signed out — sign in with your new password to continue.
            </p>
            <button
              onClick={goSignIn}
              className="inline-flex items-center justify-center bg-lucena-blue text-white border-none rounded text-[15px] font-semibold cursor-pointer transition-all hover:bg-[#002566]"
              style={{ padding: '12px 28px', background: '#003DA5', width: '100%' }}
            >
              Sign In
            </button>
          </>
        ) : state === 'waiting' || state === 'cancelling' ? null : state === 'signedInWithoutRecovery' ? (
          <>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#E6EDF9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#003DA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#003DA5', textAlign: 'center', marginBottom: 8 }}>You&apos;re Already Signed In</h1>
            <p style={{ fontSize: 14, color: '#666666', textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>
              To change your password, go to Profile → Security &amp; Password. It asks for your current password first.
            </p>
            <button
              onClick={goSecurity}
              className="inline-flex items-center justify-center bg-lucena-blue text-white border-none rounded text-[15px] font-semibold cursor-pointer transition-all hover:bg-[#002566]"
              style={{ padding: '12px 28px', background: '#003DA5', width: '100%' }}
            >
              Go to Security &amp; Password
            </button>
          </>
        ) : state === 'linkUnusable' ? (
          <>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FDECEA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C62828" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#003DA5', textAlign: 'center', marginBottom: 8 }}>Reset Link Can&apos;t Be Used</h1>
            <p style={{ fontSize: 14, color: '#666666', textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>
              {RESET_LINK_UNUSABLE_MESSAGE}
            </p>
            <button
              onClick={requestNewLink}
              className="inline-flex items-center justify-center bg-lucena-blue text-white border-none rounded text-[15px] font-semibold cursor-pointer transition-all hover:bg-[#002566]"
              style={{ padding: '12px 28px', background: '#003DA5', width: '100%' }}
            >
              Request a New Link
            </button>
          </>
        ) : (
          <>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#E6EDF9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#003DA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#003DA5', textAlign: 'center', marginBottom: 8 }}>Choose a New Password</h1>
            <p style={{ fontSize: 14, color: '#666666', textAlign: 'center', lineHeight: 1.6, marginBottom: 28 }}>
              Enter and confirm the new password for your account.
            </p>

            <div style={{ marginBottom: 8 }}>
              <label htmlFor="newPassword" className={labelClass}>New Password</label>
              <div style={{ position: 'relative', marginTop: 8 }}>
                <input
                  id="newPassword"
                  autoFocus
                  className={inputClass}
                  style={{ padding: '12px 44px 12px 16px' }}
                  type={showPasswords.new ? 'text' : 'password'}
                  placeholder="Enter your new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <PasswordVisibilityToggle
                  visible={showPasswords.new}
                  onToggle={() => setShowPasswords((prev) => ({ ...prev, new: !prev.new }))}
                />
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#666666', marginBottom: 20 }}>{PASSWORD_RULES_TEXT}</p>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="confirmPassword" className={labelClass}>Confirm New Password</label>
              <div style={{ position: 'relative', marginTop: 8 }}>
                <input
                  id="confirmPassword"
                  className={inputClass}
                  style={{ padding: '12px 44px 12px 16px' }}
                  type={showPasswords.confirm ? 'text' : 'password'}
                  placeholder="Re-enter your new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                <PasswordVisibilityToggle
                  visible={showPasswords.confirm}
                  onToggle={() => setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))}
                />
              </div>
            </div>

            {error && <p style={{ fontSize: 13, color: '#C62828', marginBottom: 16 }}>{error}</p>}

            <button
              disabled={saving}
              onClick={submit}
              className="inline-flex items-center justify-center bg-lucena-blue text-white border-none rounded text-[15px] font-semibold cursor-pointer transition-all hover:bg-[#002566]"
              style={{ padding: '12px 28px', background: '#003DA5', opacity: saving ? 0.7 : 1, width: '100%' }}
            >
              {saving ? 'Updating…' : 'Update Password'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={cancelReset}
              className="inline-flex items-center justify-center bg-white text-lucena-blue border border-[#CCCCCC] rounded text-[15px] font-semibold cursor-pointer transition-all hover:bg-[#F2F5FB] disabled:cursor-not-allowed"
              style={{ padding: '12px 28px', marginTop: 12, opacity: saving ? 0.7 : 1, width: '100%' }}
            >
              Cancel and sign out
            </button>
          </>
        )}
      </div>
    </section>
  );
}
