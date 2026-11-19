'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';
import { usePasswordResetCancelled } from '@/portals/citizen/features/auth/hooks/use-cancel-password-reset';
import { resetPasswordView, type ResetPasswordState } from '@/portals/citizen/features/auth/lib/reset-password-view';
import { PROFILE_TAB_SECURITY, profileTabHref } from '@/portals/citizen/features/profile/lib/tabs';

/**
 * The panel `/reset-password` shows, per `resetPasswordView`. Also sends a
 * signed-in citizen who did not come from the reset link to Profile →
 * Security & Password.
 *
 * `passwordUpdated` is the page's own: it is set once the update and the
 * sign-out that follows it have both gone through. A cancel, from the page or
 * the navbar, is picked up here (`useCancelPasswordReset`).
 */
export function useResetPasswordState(passwordUpdated: boolean): ResetPasswordState {
  const router = useRouter();
  const { user, loading, isPasswordRecovery } = useAuth();
  const cancelling = usePasswordResetCancelled();
  // Read once, on the first render: supabase-js strips `code` from the address
  // as soon as it has exchanged it, which is before PASSWORD_RECOVERY fires.
  const [openedFromResetLink] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('code'),
  );

  const { state, redirectToSecurity } = resetPasswordView({
    loading,
    hasUser: !!user,
    isPasswordRecovery,
    passwordUpdated,
    cancelling,
    openedFromResetLink,
  });

  useEffect(() => {
    if (redirectToSecurity) router.replace(profileTabHref(PROFILE_TAB_SECURITY));
  }, [redirectToSecurity, router]);

  return state;
}
