'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, isPasswordRecovery, openAuthModal } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (isPasswordRecovery) {
      // A recovery-link session proves only that this browser opened the
      // reset email — it does not unlock the rest of the app. Send them
      // back to finish setting a password instead of granting access.
      router.replace('/reset-password');
      return;
    }
    if (!user) {
      openAuthModal('login');
      router.replace('/');
    }
  }, [loading, user, isPasswordRecovery, openAuthModal, router]);

  if (loading || !user || isPasswordRecovery) return null;
  return <>{children}</>;
}
