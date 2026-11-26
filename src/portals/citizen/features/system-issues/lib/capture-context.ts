/**
 * What a System issue report carries without asking the Citizen: the page they
 * came from and their browser. Only a path is ever kept, never a query string
 * or hash, which can hold a reset code or a token.
 *
 * `document.referrer` alone cannot say where they came from: a client-side
 * navigation never updates it. So `PageTrail`, mounted once in the Citizen
 * layout, records each path the router shows, and the one before the current
 * page is the page they came from.
 */

let trail: { previous: string | null; current: string | null } = { previous: null, current: null };

/** Called by `PageTrail` on every route change. */
export function recordPath(path: string): void {
  if (path === trail.current) return;
  trail = { previous: trail.current, current: path };
}

/**
 * The page the Citizen came from: the previous in-app path, else a same-origin
 * referrer (a full page load), else the page they are on.
 */
export function capturePage(): string {
  if (typeof window === 'undefined') return '';
  const here = window.location.pathname;
  if (trail.previous && trail.previous !== here) return trail.previous;
  try {
    if (document.referrer) {
      const ref = new URL(document.referrer);
      if (ref.origin === window.location.origin && ref.pathname !== here) return ref.pathname;
    }
  } catch {
    // An unparsable referrer is no referrer.
  }
  return here;
}

/** A user agent string, summarised for the Citizen to read ("Chrome on Windows"). */
export function describeBrowser(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'your browser';
  const device = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone|iPad/.test(userAgent)
      ? 'iPhone or iPad'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS/.test(userAgent)
          ? 'Mac'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;
  return device ? `${browser} on ${device}` : browser;
}
