import { describe, expect, it } from "vitest";
import {
  columnsOf,
  createFailingFetch,
  createRecordingFetch,
  createTableFetch,
  createTestClient,
  parseQueryParams,
  requestTo,
} from "@/portals/staff/lib/supabase/testing";
import { getNotifications, getUnreadNotificationCount } from "./queries";

/** A my_notifications row as l81's sweep writes one. */
function aNoticeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "n-1",
    module_code: "yellow_card",
    record_id: "app-1",
    title: "YC-2026-000066 is At Risk",
    body: "Its Processing Deadline is 16 October 2026, 3:00 PM. Open the Yellow Card queue to review it.",
    created_at: "2026-10-16T04:07:00.000+00:00",
    read_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

describe("getNotifications", () => {
  it("reads my_notifications, newest first, every row, with the exact column list", async () => {
    const { fetch, requests } = createTableFetch({ my_notifications: [] });

    await getNotifications(createTestClient(fetch));

    const read = requestTo(requests, "my_notifications");
    expect(columnsOf(read)).toEqual([
      "id",
      "module_code",
      "record_id",
      "title",
      "body",
      "created_at",
      "read_at",
    ]);
    expect(read.order).toBe("created_at.desc");
    // "Every notice" (SCRUM-236): a cap would leave the oldest unread notices
    // counted by the bell and unreachable from the list.
    expect(read.limit).toBeNull();
  });

  it("maps a row into a notice", async () => {
    const { fetch } = createTableFetch({
      my_notifications: [aNoticeRow()],
      staff_yellow_card_queue: [{ id: "app-1", status: "pending" }],
    });

    const [notice] = await getNotifications(createTestClient(fetch));

    expect(notice).toEqual({
      id: "n-1",
      title: "YC-2026-000066 is At Risk",
      body: "Its Processing Deadline is 16 October 2026, 3:00 PM. Open the Yellow Card queue to review it.",
      createdAt: "2026-10-16T04:07:00.000+00:00",
      readAt: null,
      applicationStatus: "pending",
    });
  });

  /**
   * The point of showing status at all: a warning about an application that
   * has since been decided is moot, and the reader should see that without
   * opening it. Deciding does not mark or hide the notice — it is still here.
   */
  it("shows a decided application's current status beside its notice", async () => {
    const { fetch } = createTableFetch({
      my_notifications: [aNoticeRow({ read_at: null })],
      staff_yellow_card_queue: [{ id: "app-1", status: "approved" }],
    });

    const [notice] = await getNotifications(createTestClient(fetch));

    expect(notice.applicationStatus).toBe("approved");
    expect(notice.readAt).toBeNull();
  });

  it("asks the queue for the status of exactly the Yellow Card records in the list", async () => {
    const { fetch, requests } = createTableFetch({
      my_notifications: [
        aNoticeRow({ id: "n-1", record_id: "app-1" }),
        aNoticeRow({ id: "n-2", record_id: "app-2" }),
        aNoticeRow({ id: "n-3", record_id: "app-1" }),
        aNoticeRow({ id: "n-4", module_code: "booking", record_id: "bk-1" }),
      ],
    });

    await getNotifications(createTestClient(fetch));

    const statusRead = requestTo(requests, "staff_yellow_card_queue");
    expect(columnsOf(statusRead)).toEqual(["id", "status"]);
    expect(statusRead.filters).toEqual({ id: ["in.(app-1,app-2)"] });
  });

  it("gives a notice no status when it is not about a Yellow Card application", async () => {
    const { fetch } = createTableFetch({
      my_notifications: [aNoticeRow({ module_code: "booking", record_id: "bk-1" })],
    });

    const [notice] = await getNotifications(createTestClient(fetch));

    expect(notice.applicationStatus).toBeNull();
  });

  /**
   * A failed gate on staff_yellow_card_queue is HTTP 200 and no rows — a staff
   * member whose module was taken away keeps their old notices. The notice
   * still renders; it just cannot say how the application stands.
   */
  it("gives a notice no status when the queue does not return its application", async () => {
    const { fetch } = createTableFetch({
      my_notifications: [aNoticeRow()],
      staff_yellow_card_queue: [],
    });

    const [notice] = await getNotifications(createTestClient(fetch));

    expect(notice.applicationStatus).toBeNull();
  });

  it("sends no status read when no notice is about a Yellow Card application", async () => {
    const { fetch, requests } = createTableFetch({ my_notifications: [] });

    await getNotifications(createTestClient(fetch));

    expect(requests.map((r) => r.table)).toEqual(["my_notifications"]);
  });

  it("raises rather than reading a failure as an empty list", async () => {
    const { fetch } = createFailingFetch({ message: "boom" });

    await expect(getNotifications(createTestClient(fetch))).rejects.toThrow(
      /my_notifications read failed: boom/,
    );
  });

  it("raises when the status read fails", async () => {
    const { fetch } = createTableFetch(
      { my_notifications: [aNoticeRow()] },
      { table: "staff_yellow_card_queue", message: "boom" },
    );

    await expect(getNotifications(createTestClient(fetch))).rejects.toThrow(
      /staff_yellow_card_queue read failed: boom/,
    );
  });
});

// ---------------------------------------------------------------------------
// The bell's count
// ---------------------------------------------------------------------------

describe("getUnreadNotificationCount", () => {
  it("counts the unread rows without fetching them", async () => {
    const { fetch, requests } = createRecordingFetch([], { rowCount: 3 });

    const count = await getUnreadNotificationCount(createTestClient(fetch));

    expect(count).toBe(3);
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("HEAD");
    const params = parseQueryParams(requests[0].url);
    expect(params.table).toBe("my_notifications");
    expect(params.filters).toEqual({ read_at: ["is.null"] });
  });

  it("reads zero as zero", async () => {
    const { fetch } = createRecordingFetch([], { rowCount: 0 });

    expect(await getUnreadNotificationCount(createTestClient(fetch))).toBe(0);
  });

  /**
   * The layout renders this on every Staff page, so a throw would turn one
   * failed badge read into an error page everywhere. Null, not zero: zero would
   * say "nothing needs you", which is the one thing the bell must never say
   * by accident.
   */
  it("reads a failure as unknown, never as zero", async () => {
    const { fetch } = createFailingFetch({ message: "boom" });

    expect(await getUnreadNotificationCount(createTestClient(fetch))).toBeNull();
  });
});
