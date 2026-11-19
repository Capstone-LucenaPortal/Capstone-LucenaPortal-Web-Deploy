'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

// How many new-password saves this tab has running. The reset page starts
// them; the reset-mode navbar reads the flag so its "Sign out" can't race a
// save (issue #151). Module-level like the cancel count beside it, because the
// page and the navbar are separate components.
let updatesInFlight = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function changeInFlight(by: number) {
  updatesInFlight += by;
  listeners.forEach((listener) => listener());
}

const getInFlight = () => updatesInFlight > 0;
const getServerInFlight = () => false;

/**
 * Run a new-password save as "in flight" from start to end, however it ends.
 * A component that unmounts mid-save gives up its share, so the flag can't
 * stay stuck on for the rest of the visit.
 */
export function useTrackPasswordUpdate(): (update: () => Promise<void>) => Promise<void> {
  const held = useRef(0);

  useEffect(
    () => () => {
      if (held.current > 0) {
        changeInFlight(-held.current);
        held.current = 0;
      }
    },
    [],
  );

  // A count, not a flag: a second click before the re-render still balances.
  return useCallback(async (update: () => Promise<void>) => {
    held.current += 1;
    changeInFlight(1);
    try {
      await update();
    } finally {
      // Already given back if the component unmounted mid-save.
      if (held.current > 0) {
        held.current -= 1;
        changeInFlight(-1);
      }
    }
  }, []);
}

/** Whether a new password is being saved in this tab right now. */
export function usePasswordUpdateInFlight(): boolean {
  return useSyncExternalStore(subscribe, getInFlight, getServerInFlight);
}
