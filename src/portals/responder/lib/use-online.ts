"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Whether the browser has a connection (ISO-9). navigator.onLine only knows
 * about the device's network, not whether the server answers, so `true` is
 * "maybe" — but `false` is certain, and certain is what the copy keys off.
 *
 * The server has no navigator; it renders as connected, which is the case it
 * is rendering in.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * router.push that does nothing while offline (issue #7). Offline, a push's
 * data request fails and Next falls back to a full page load — the browser's
 * own error page. The offline banner holds link taps and form submits; this
 * is the same hold for navigation started in code, such as closing a sheet.
 *
 * Held, not queued: the responder is told by the banner, and taps again.
 */
export function useOnlinePush(): (href: string) => void {
  const router = useRouter();
  return useCallback(
    (href: string) => {
      if (!navigator.onLine) return;
      router.push(href);
    },
    [router],
  );
}

/** Runs `onReconnect` each time the connection comes back — not on mount. */
export function useOnReconnect(onReconnect: () => void) {
  const online = useOnline();
  const wasOnline = useRef(online);
  const latest = useRef(onReconnect);

  useEffect(() => {
    latest.current = onReconnect;
  });

  useEffect(() => {
    if (online && !wasOnline.current) latest.current();
    wasOnline.current = online;
  }, [online]);

  return online;
}
