'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';

// How many cancels this tab has started. A count rather than a flag, so it
// never needs resetting: a page compares it with the count it saw on mount.
// The reset page and the navbar are separate components, and a cancel from
// either must reach the page before `logout()` clears the session.
let cancelsStarted = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getCancelsStarted = () => cancelsStarted;

/**
 * Leave a password reset without finishing it (issue #44): sign out, which
 * ends the recovery here and in every other tab, then go home. A failed
 * sign-out still lands on home; `logout()` has already cleared the local
 * session by then.
 */
export function useCancelPasswordReset(): () => Promise<void> {
  const router = useRouter();
  const { logout } = useAuth();
  return useCallback(async () => {
    cancelsStarted += 1;
    listeners.forEach((listener) => listener());
    try {
      await logout();
    } catch {
      // `logout()` ends the session locally even when the network call fails.
    } finally {
      router.push('/');
    }
  }, [logout, router]);
}

/** Whether a cancel has started since the calling component mounted. */
export function usePasswordResetCancelled(): boolean {
  const cancels = useSyncExternalStore(subscribe, getCancelsStarted, getCancelsStarted);
  const [cancelsAtMount] = useState(getCancelsStarted);
  return cancels > cancelsAtMount;
}
