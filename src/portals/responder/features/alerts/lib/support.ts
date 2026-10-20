/**
 * Can THIS device get a Phone alert (ADR 0001, SCRUM-162)?
 *
 * Decided from a snapshot of the browser, so the decision itself is pure and
 * the snapshot is the only thing that touches `navigator`.
 */

export type AlertSupport =
  /** This deployment cannot sign a device up: no VAPID key, or not a production build. */
  | "unavailable"
  /** iPhone/iPad in the browser: web push exists only from the Home Screen (iOS 16.4+). */
  | "needs-install"
  /** The browser has no push at all. */
  | "unsupported"
  /** The responder refused notifications for the site; only browser settings undo it. */
  | "blocked"
  | "ready";

export interface AlertEnvironment {
  vapidKey: string;
  production: boolean;
  serviceWorker: boolean;
  pushManager: boolean;
  /** null when the browser has no Notification API. */
  permission: NotificationPermission | null;
  ios: boolean;
  /** Opened from the Home Screen rather than in a browser tab. */
  standalone: boolean;
}

export function alertSupport(env: AlertEnvironment): AlertSupport {
  // The service worker registers in production only (service-worker.tsx), and
  // without a public key there is nothing to subscribe with.
  if (!env.vapidKey || !env.production) return "unavailable";
  if (env.ios && !env.standalone) return "needs-install";
  if (!env.serviceWorker || !env.pushManager || env.permission === null) {
    return "unsupported";
  }
  if (env.permission === "denied") return "blocked";
  return "ready";
}

/** iPadOS reports itself as a Mac; touch points tell the two apart. */
export function isIOS(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
): boolean {
  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
}

export function readEnvironment(): AlertEnvironment {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    production: process.env.NODE_ENV === "production",
    serviceWorker: "serviceWorker" in navigator,
    pushManager: "PushManager" in window,
    permission: "Notification" in window ? Notification.permission : null,
    ios: isIOS(nav.userAgent, nav.platform, nav.maxTouchPoints ?? 0),
    standalone:
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      nav.standalone === true,
  };
}

/** The base64url VAPID public key as the bytes pushManager.subscribe() takes. */
export function vapidKeyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
