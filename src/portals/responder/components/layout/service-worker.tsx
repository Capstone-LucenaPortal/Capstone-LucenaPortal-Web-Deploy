"use client";

import { useEffect } from "react";

/**
 * Registers public/responder/sw.js (ISO-9, issue #7), which answers a page
 * load that cannot reach the server with an in-app "Try again" page instead
 * of the browser's own error page. Mounted in the Responder root layout, so
 * it is in place from the login page on — before the first drop, not after.
 *
 * Production only: in `next dev` a worker outlives the code it was built from
 * and gets in the way of hot reload.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // A worker that fails to register leaves the browser's default behaviour,
    // which is what the portal had before; nothing to tell the responder.
    navigator.serviceWorker
      .register("/responder/sw.js", { scope: "/responder/" })
      .catch(() => {});
  }, []);

  return null;
}
