// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

/**
 * public/responder/sw.js is served as-is, never bundled, so it is loaded here
 * the way a browser would: as a classic script against a `self`.
 */
function loadWorker(
  fetchImpl: (req: Request) => Promise<Response>,
  windows: FakeWindow[] = [],
) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const claim = vi.fn().mockResolvedValue(undefined);
  const skipWaiting = vi.fn().mockResolvedValue(undefined);
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const matchAll = vi.fn().mockResolvedValue(windows);
  const openWindow = vi.fn().mockResolvedValue(null);
  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      handlers[type] = fn;
    },
    clients: { claim, matchAll, openWindow },
    registration: { showNotification },
    skipWaiting,
    location: { origin: "https://portal.test" },
  };
  runInNewContext(
    readFileSync(join(process.cwd(), "public/responder/sw.js"), "utf8"),
    { self, fetch: fetchImpl, Response, URL },
  );
  return { handlers, claim, skipWaiting, showNotification, matchAll, openWindow };
}

/** Runs one handler and waits for everything it handed to waitUntil(). */
async function dispatch(handler: (event: unknown) => void, event: object) {
  const waits: Promise<unknown>[] = [];
  handler({ ...event, waitUntil: (p: Promise<unknown>) => waits.push(p) });
  await Promise.all(waits);
}

/** A PushEvent whose data.json() returns the payload, or throws on bad JSON. */
function pushEvent(payload: unknown) {
  if (payload === undefined) return { data: null };
  return {
    data: {
      json: () => (typeof payload === "string" ? JSON.parse(payload) : payload),
    },
  };
}

type FakeWindow = {
  url: string;
  focus: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
};

function windowClient(url: string): FakeWindow {
  const client: FakeWindow = { url, focus: vi.fn(), navigate: vi.fn() };
  client.focus.mockResolvedValue(client);
  client.navigate.mockResolvedValue(client);
  return client;
}

function clickEvent(data: unknown) {
  const close = vi.fn();
  return { event: { notification: { data, close } }, close };
}

const INCIDENT = "7c0e0f6a-4b1d-4f7e-9a51-2f4c8f1d2b3a";

function fetchEvent(url: string, mode: RequestMode) {
  const request = { url, mode, method: "GET" } as Request;
  let responded: Promise<Response> | undefined;
  return {
    event: {
      request,
      respondWith: (r: Promise<Response>) => {
        responded = r;
      },
      waitUntil: () => {},
    },
    responded: () => responded,
  };
}

describe("Responder service worker", () => {
  it("passes a page load through when the server answers", async () => {
    const page = new Response("<p>pool</p>", { status: 200 });
    const { handlers } = loadWorker(() => Promise.resolve(page));
    const { event, responded } = fetchEvent("https://portal.test/responder/pool", "navigate");

    handlers.fetch(event);

    expect(await responded()).toBe(page);
  });

  // ISO-9 / issue #7: offline, or with the server unreachable, Next falls back
  // to a full page load, and a failed one is the browser's own error page.
  it("answers a page load that cannot reach the server with an in-app page", async () => {
    const { handlers } = loadWorker(() => Promise.reject(new TypeError("Failed to fetch")));
    const { event, responded } = fetchEvent("https://portal.test/responder/history", "navigate");

    handlers.fetch(event);
    const res = (await responded())!;

    expect(res.status).toBe(503);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toMatch(/Try again/);
    expect(html).toMatch(/LucenaPortal Responder/);
  });

  // Data requests, RSC payloads, scripts and photos are left to the browser:
  // nothing is cached, so nothing can be served stale.
  it("leaves every request that is not a page load alone", () => {
    const fetchImpl = vi.fn();
    const { handlers } = loadWorker(fetchImpl);
    const { event, responded } = fetchEvent("https://portal.test/responder/pool?_rsc=1", "cors");

    handlers.fetch(event);

    expect(responded()).toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("leaves page loads outside the Responder Portal alone", () => {
    const { handlers } = loadWorker(vi.fn());
    const { event, responded } = fetchEvent("https://portal.test/staff/login", "navigate");

    handlers.fetch(event);

    expect(responded()).toBeUndefined();
  });

  // The tab that registered it is already open; without claim() the first
  // drop on that tab would still reach the browser's error page.
  it("takes over open tabs as soon as it activates", async () => {
    const { handlers, claim, skipWaiting } = loadWorker(vi.fn());
    const waits: Promise<unknown>[] = [];

    handlers.install({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    handlers.activate({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);

    expect(skipWaiting).toHaveBeenCalled();
    expect(claim).toHaveBeenCalled();
  });
});

// ADR 0001: a phone alert for a pool arrival. The payload is built by the
// send-push-queue Edge Function as { title, body, incidentId, tag }; title and
// body were rendered by the database and never carry the citizen's
// description.
describe("Responder service worker — phone alerts", () => {
  it("shows the alert the sender rendered, and remembers which incident it is for", async () => {
    const { handlers, showNotification } = loadWorker(vi.fn());

    await dispatch(
      handlers.push,
      pushEvent({
        title: "New critical incident in your pool",
        body: "INC-2026-000120 — Engineering",
        incidentId: INCIDENT,
        tag: `incident-${INCIDENT}`,
      }),
    );

    expect(showNotification).toHaveBeenCalledTimes(1);
    const [title, options] = showNotification.mock.calls[0];
    expect(title).toBe("New critical incident in your pool");
    expect(options.body).toBe("INC-2026-000120 — Engineering");
    expect(options.tag).toBe(`incident-${INCIDENT}`);
    expect(options.data).toEqual({ url: `/responder/pool?report=${INCIDENT}` });
  });

  // userVisibleOnly: a push that shows nothing breaks the promise made to the
  // browser, which then shows its own generic notice. A payload this worker
  // cannot read still alerts, and opens the pool.
  it("still alerts, pointing at the pool, when the payload is missing or unreadable", async () => {
    for (const event of [pushEvent(undefined), pushEvent("{not json")]) {
      const { handlers, showNotification } = loadWorker(vi.fn());

      await dispatch(handlers.push, event);

      expect(showNotification).toHaveBeenCalledTimes(1);
      const [title, options] = showNotification.mock.calls[0];
      expect(title).toBe("New work in your pool");
      expect(options.data).toEqual({ url: "/responder/pool" });
    }
  });

  // The id goes into a URL this worker opens. Anything that is not a uuid
  // opens the pool instead of a crafted path.
  it("never builds a link out of an incident id that is not a uuid", async () => {
    const { handlers, showNotification } = loadWorker(vi.fn());

    await dispatch(
      handlers.push,
      pushEvent({ title: "t", body: "b", incidentId: "../../admin" }),
    );

    expect(showNotification.mock.calls[0][1].data).toEqual({ url: "/responder/pool" });
  });

  it("opens the incident in a new window when no Portal tab is open", async () => {
    const { handlers, openWindow } = loadWorker(vi.fn());
    const { event, close } = clickEvent({ url: `/responder/pool?report=${INCIDENT}` });

    await dispatch(handlers.notificationclick, event);

    expect(close).toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledWith(`/responder/pool?report=${INCIDENT}`);
  });

  it("reuses an open Portal tab rather than opening a second one", async () => {
    const tab = windowClient("https://portal.test/responder/history");
    const { handlers, openWindow, matchAll } = loadWorker(vi.fn(), [tab]);
    const { event } = clickEvent({ url: `/responder/pool?report=${INCIDENT}` });

    await dispatch(handlers.notificationclick, event);

    expect(tab.navigate).toHaveBeenCalledWith(`/responder/pool?report=${INCIDENT}`);
    expect(openWindow).not.toHaveBeenCalled();
    // A tab this worker does not control is still the Portal tab.
    expect(matchAll).toHaveBeenCalledWith({ type: "window", includeUncontrolled: true });
  });

  // The right to raise a window lasts only a moment after the tap; a slow
  // navigate() must not use it up first.
  it("focuses the tab before navigating it", async () => {
    const tab = windowClient("https://portal.test/responder/history");
    const order: string[] = [];
    tab.focus.mockImplementation(async () => (order.push("focus"), tab));
    tab.navigate.mockImplementation(async () => (order.push("navigate"), tab));
    const { handlers } = loadWorker(vi.fn(), [tab]);
    const { event } = clickEvent({ url: `/responder/pool?report=${INCIDENT}` });

    await dispatch(handlers.notificationclick, event);

    expect(order).toEqual(["focus", "navigate"]);
  });

  it("leaves tabs of other Portals alone", async () => {
    const staff = windowClient("https://portal.test/staff/queue");
    const { handlers, openWindow } = loadWorker(vi.fn(), [staff]);
    const { event } = clickEvent({ url: `/responder/pool?report=${INCIDENT}` });

    await dispatch(handlers.notificationclick, event);

    expect(staff.navigate).not.toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledWith(`/responder/pool?report=${INCIDENT}`);
  });

  // navigate() rejects on a tab this worker does not control (one opened
  // before it activated). The tap must still land somewhere.
  it("falls back to a new window when the open tab cannot be navigated", async () => {
    const tab = windowClient("https://portal.test/responder/pool");
    tab.navigate.mockRejectedValue(new TypeError("not controlled"));
    const { handlers, openWindow } = loadWorker(vi.fn(), [tab]);
    const { event } = clickEvent({ url: `/responder/pool?report=${INCIDENT}` });

    await dispatch(handlers.notificationclick, event);

    expect(openWindow).toHaveBeenCalledWith(`/responder/pool?report=${INCIDENT}`);
  });

  it("opens only Responder Portal paths, whatever the notification carries", async () => {
    const { handlers, openWindow } = loadWorker(vi.fn());
    const { event } = clickEvent({ url: "https://evil.test/phish" });

    await dispatch(handlers.notificationclick, event);

    expect(openWindow).toHaveBeenCalledWith("/responder/pool");
  });
});
