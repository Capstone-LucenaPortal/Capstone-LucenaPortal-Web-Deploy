"use client";

import { useCallback, useRef } from "react";

/**
 * A form action that runs once at a time (ISO-9). On a slow field connection a
 * second tap on Resolve, Release or Send back would otherwise send a second
 * RPC for an incident the first one already moved.
 *
 * The lock is a ref, not state: two taps in the same frame both land before
 * React re-renders, so a disabled button alone would let the second through.
 * The button's disabled look comes from useFormStatus in <SubmitButton>; this
 * is the guard.
 *
 * A dropped call resolves quietly — the first one is already doing the work.
 * A rejection is passed on, because a server action that redirects rejects on
 * the client and Next's RedirectBoundary navigates on it; the lock is released
 * either way, so a redirect back to the same page leaves a live button.
 *
 * ⚠️ THE GUARD ENDS WHEN THE ANSWER ARRIVES, NOT WHEN THE NEXT PAGE COMMITS.
 * A tap in between is let through. It cannot double-act: each RPC refuses
 * unless the incident is still in progress and yours, so the late call comes
 * back as a notice. Holding the lock across the navigation would need the
 * router, and would leave a dead button whenever a redirect lands on the URL
 * already showing.
 */
export function useSingleFlight(
  action: (formData: FormData) => Promise<void>,
): (formData: FormData) => Promise<void> {
  const inFlight = useRef(false);
  return useCallback(
    async (formData: FormData) => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        await action(formData);
      } finally {
        inFlight.current = false;
      }
    },
    [action],
  );
}
