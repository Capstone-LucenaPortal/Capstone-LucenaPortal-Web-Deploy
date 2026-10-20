"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOnReconnect } from "@/portals/responder/lib/use-online";

/**
 * Says the connection is gone, under the header, on every authenticated page
 * (ISO-9) — and while it is gone, holds the taps that would need it.
 *
 * Holding is what keeps the page. Offline, a link's RSC fetch fails and Next
 * falls back to a full browser navigation, which lands on the browser's own
 * "no internet" page; a form action fails into the error boundary and takes
 * whatever was typed with it. Held, the responder can still read the address
 * and the report they were driving to, and a half-written note is still there.
 *
 * When the connection returns, the server render is fetched again: the pool
 * and the held ticket on screen are from before the drop.
 */
export function OfflineBanner() {
  const router = useRouter();
  const online = useOnReconnect(() => router.refresh());

  useEffect(() => {
    if (online) return;
    // Capture on window runs before React's own listeners on the root, so
    // both Next's Link and React's form actions see defaultPrevented and
    // stand down.
    window.addEventListener("click", holdNavigation, true);
    window.addEventListener("submit", holdSubmit, true);
    return () => {
      window.removeEventListener("click", holdNavigation, true);
      window.removeEventListener("submit", holdSubmit, true);
    };
  }, [online]);

  // The live region is always mounted, so the message is announced when it
  // appears rather than only read if someone goes looking for it.
  return (
    <div role="status" aria-live="polite">
      {!online && (
        <p className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">
          <span className="font-semibold">You are offline.</span> This page
          stays as it is. Nothing you tap will be sent — try again once you
          reconnect.
        </p>
      )}
    </div>
  );
}

function holdSubmit(event: Event) {
  event.preventDefault();
}

/**
 * Only a link to another page of this app is held. A tel: link to the citizen
 * needs signal, not data, and an in-page #fragment fetches nothing.
 */
function holdNavigation(event: MouseEvent) {
  const link = (event.target as Element | null)?.closest?.("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return;

  const to = new URL(link.href, location.href);
  if (to.origin !== location.origin) return;
  if (to.pathname === location.pathname && to.search === location.search) return;

  event.preventDefault();
}
