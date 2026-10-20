/*
 * Responder Portal service worker (ISO-9, issue #7).
 *
 * It does two things. First, when a PAGE LOAD under /responder/ cannot reach the
 * server, it answers with a small in-app page instead of letting the browser
 * show its own error page.
 *
 * That page load is how Next.js recovers from a failed client navigation — a
 * <Link> or router.push whose data request fails is retried as a full page
 * load. Offline, or with the server unreachable, that retry fails too, and
 * without this worker the responder lands on "This site can't be reached".
 *
 * Second, it shows a phone alert when new work enters the pool (ADR 0001,
 * SCRUM-162), and a tap on it opens that incident. See the end of this file.
 *
 * Nothing is cached. Every other request (data, scripts, photos) is left to
 * the browser untouched, so nothing can ever be served stale; the fallback
 * page is built here rather than precached because a precached .html would
 * go through the request guard and could cache a login redirect.
 *
 * Served as-is from public/, never bundled: plain browser JavaScript only.
 * Tested by src/portals/responder/lib/service-worker.test.ts.
 */

const SCOPE = "/responder/";

const FALLBACK_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#003DA5">
<title>Can't reach the server · LucenaPortal Responder</title>
<style>
  body { margin: 0; min-height: 100dvh; display: flex; align-items: center; justify-content: center;
         padding: 0 16px; background: #F9FAFB; color: #111827;
         font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .card { width: 100%; max-width: 384px; box-sizing: border-box; padding: 24px;
          border: 1px solid #E5E7EB; border-radius: 8px; background: #FFFFFF; }
  .brand { margin: 0 0 12px; font-size: 12px; font-weight: 600; color: #003DA5; }
  h1 { margin: 0; font-size: 17px; line-height: 1.25; }
  p { margin: 10px 0 0; font-size: 13px; color: #4B5563; }
  button { margin-top: 20px; width: 100%; height: 48px; border: 0; border-radius: 6px;
           background: #003DA5; color: #FFFFFF; font-size: 15px; font-weight: 600; cursor: pointer; }
  button:focus-visible { outline: 3px solid #003DA5; outline-offset: 2px; }
</style>
</head>
<body>
<main class="card">
  <p class="brand">LucenaPortal Responder</p>
  <h1 id="title">Can't reach the server</h1>
  <p id="body">This page could not load. Check your signal, then try again. It will also try again by itself when your connection comes back.</p>
  <button type="button" id="retry">Try again</button>
</main>
<script>
  if (!navigator.onLine) {
    document.getElementById("title").textContent = "You are offline";
  }
  document.getElementById("retry").addEventListener("click", function () { location.reload(); });
  window.addEventListener("online", function () { location.reload(); });
</script>
</body>
</html>`;

function fallbackPage() {
  return new Response(FALLBACK_HTML, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // The page's own policy: its inline style and script, nothing else.
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}

self.addEventListener("install", function (event) {
  event.waitUntil(self.skipWaiting());
});

// Take over the tab that registered it, so the first drop on that tab is
// already covered.
self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.mode !== "navigate") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;

  event.respondWith(
    fetch(request).catch(function () {
      return fallbackPage();
    }),
  );
});

/*
 * Phone alerts (ADR 0001, SCRUM-162). The send-push-queue Edge Function sends
 * { title, body, incidentId, tag } for an incident that entered the pool.
 * Title and body were rendered by the database for the lock screen: reference
 * number and department, never the citizen's description. Nothing is added
 * here.
 */

const POOL = SCOPE + "pool";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readAlert(data) {
  try {
    return (data && data.json()) || {};
  } catch {
    return {};
  }
}

// The id goes into a URL. Anything that is not a uuid opens the pool.
function alertUrl(incidentId) {
  return typeof incidentId === "string" && UUID.test(incidentId)
    ? POOL + "?report=" + incidentId
    : POOL;
}

self.addEventListener("push", function (event) {
  const alert = readAlert(event.data);
  const title = typeof alert.title === "string" && alert.title ? alert.title : "New work in your pool";
  const options = {
    body: typeof alert.body === "string" ? alert.body : "",
    icon: "/Lucena_City_Seal.png",
    data: { url: alertUrl(alert.incidentId) },
  };
  // One alert per incident: a retry replaces it instead of stacking.
  if (typeof alert.tag === "string" && alert.tag) options.tag = alert.tag;

  // userVisibleOnly: every push must show something, so an unreadable one
  // still alerts and opens the pool.
  event.waitUntil(self.registration.showNotification(title, options));
});

// Only a path inside this Portal is ever opened, whatever the alert carries.
function safePath(url) {
  return typeof url === "string" && url.startsWith(SCOPE) ? url : POOL;
}

function isPortalTab(client) {
  try {
    const url = new URL(client.url);
    return url.origin === self.location.origin && url.pathname.startsWith(SCOPE);
  } catch {
    return false;
  }
}

// The tap opens the incident's pool detail; that page marks its Inbox entry
// read. An expired session goes through the login guard and comes back here.
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const target = safePath(event.notification.data && event.notification.data.url);

  event.waitUntil(
    // includeUncontrolled: a tab opened before this worker activated, or
    // hard-reloaded past it, is still the responder's Portal tab.
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clients) {
        const tab = clients.find(isPortalTab);
        if (!tab) return self.clients.openWindow(target);

        // Focus FIRST: the right to raise a window lasts only a moment after
        // the tap, and a navigate() on a slow connection can outlast it.
        // navigate() then rejects on a tab this worker does not control.
        return tab
          .focus()
          .then(function (focused) {
            return (focused || tab).navigate(target);
          })
          .catch(function () {
            return self.clients.openWindow(target);
          });
      }),
  );
});

// ⚠️ No pushsubscriptionchange handler, deliberately: re-registering a rotated
// endpoint needs register_push_subscription, which needs the responder's
// session, and a worker has none. The sender deletes the dead endpoint on its
// 410, and the profile and pool banner then show alerts as off on next open.
