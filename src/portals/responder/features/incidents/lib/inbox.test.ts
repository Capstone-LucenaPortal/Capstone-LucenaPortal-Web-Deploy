import { beforeEach, describe, expect, it, vi } from "vitest";
import { getInbox, getUnreadCount } from "@/portals/responder/features/incidents/lib/inbox";
import { aNotification } from "@/portals/responder/features/incidents/lib/fixtures";

/** The one seam is faked, as in pages.test.tsx: lib/data.ts, not the client. */
const db = vi.hoisted(() => ({
  notifications: [] as unknown[],
  unread: [] as unknown[],
  visible: [] as unknown[],
  lookupError: null as Error | null,
}));

vi.mock("@/portals/responder/features/incidents/lib/data", () => ({
  getNotifications: async () => db.notifications,
  getUnreadNotifications: async () => db.unread,
  getVisibleIncidentStatuses: async () => {
    if (db.lookupError) throw db.lookupError;
    return db.visible;
  },
}));

const GONE = "00000000-0000-4000-8000-000000000124";
const LIVE = "00000000-0000-4000-8000-000000000125";

beforeEach(() => {
  db.notifications = [];
  db.unread = [];
  db.visible = [{ id: LIVE, status: "in_pool" }];
  db.lookupError = null;
});

describe("getUnreadCount", () => {
  it("leaves an unread stale arrival out of the badge", async () => {
    db.unread = [
      { id: "n1", event_code: "incident_pool_arrival", record_id: GONE },
      { id: "n2", event_code: "incident_pool_arrival", record_id: LIVE },
    ];

    expect(await getUnreadCount()).toBe(1);
  });

  it("counts every unread row that is not an arrival", async () => {
    db.unread = [
      { id: "n1", event_code: "incident_pooled", record_id: GONE },
      { id: "n2", event_code: "ticket_released", record_id: null },
    ];

    expect(await getUnreadCount()).toBe(2);
  });

  it("throws when the lookup fails, rather than zeroing the badge", async () => {
    db.unread = [{ id: "n1", event_code: "incident_pool_arrival", record_id: LIVE }];
    db.lookupError = new Error("getVisibleIncidentStatuses: timeout");

    await expect(getUnreadCount()).rejects.toThrow(/timeout/);
  });
});

describe("getInbox", () => {
  it("flags a stale arrival and leaves the stored row as it is", async () => {
    const gone = aNotification({ id: "n1", event_code: "incident_pool_arrival", record_id: GONE });
    const live = aNotification({ id: "n2", event_code: "incident_pool_arrival", record_id: LIVE });
    db.notifications = [gone, live];

    expect(await getInbox()).toEqual([
      { ...gone, stale: true },
      { ...live, stale: false },
    ]);
  });

  it("throws when the lookup fails, rather than hiding or relabelling rows", async () => {
    db.notifications = [
      aNotification({ id: "n1", event_code: "incident_pool_arrival", record_id: LIVE }),
    ];
    db.lookupError = new Error("getVisibleIncidentStatuses: timeout");

    await expect(getInbox()).rejects.toThrow(/timeout/);
  });
});
