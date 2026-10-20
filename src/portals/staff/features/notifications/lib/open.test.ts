import { describe, expect, it } from "vitest";
import {
  createTestClient,
  parseProcedureName,
  postgrestErrorBody,
} from "@/portals/staff/lib/supabase/testing";
import { openNotification } from "./open";

/**
 * mark_notification_read returns the `notifications` row itself — one object,
 * not an array — which the shared recorder cannot answer with. So this file
 * keeps its own: it records each request and answers with the row given, or
 * with a PostgREST error.
 */
function answering(response: { row: Record<string, unknown> } | { error: string }) {
  const requests: { url: string; body: unknown }[] = [];

  const fetch: typeof globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    const text = await req.text();
    requests.push({ url: req.url, body: text ? JSON.parse(text) : undefined });

    return "row" in response
      ? new Response(JSON.stringify(response.row), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      : new Response(JSON.stringify(postgrestErrorBody(response.error, "P0002")), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
  };

  return { db: createTestClient(fetch), requests };
}

const NOTICE_ROW = {
  id: "n-1",
  module_code: "yellow_card",
  record_id: "app-1",
  event_code: "yc_overdue",
  read_at: "2026-10-16T05:00:00.000+00:00",
};

describe("openNotification", () => {
  it("marks the notice read through mark_notification_read", async () => {
    const { db, requests } = answering({ row: NOTICE_ROW });

    await openNotification(db, "n-1");

    expect(requests).toHaveLength(1);
    expect(parseProcedureName(requests[0].url)).toBe("mark_notification_read");
    expect(requests[0].body).toEqual({ p_notification_id: "n-1" });
  });

  it("opens a Yellow Card notice's application", async () => {
    const { db } = answering({ row: NOTICE_ROW });

    expect(await openNotification(db, "n-1")).toBe("/staff/yellow-card/app-1");
  });

  /**
   * The destination is read off the row the database returned, which is the
   * caller's own (the RPC scopes on recipient_user_id). Nothing the browser
   * sends decides where the redirect goes.
   */
  it("stays on the list for a notice that is not about a Yellow Card application", async () => {
    const { db } = answering({
      row: { ...NOTICE_ROW, module_code: "booking", record_id: "bk-1" },
    });

    expect(await openNotification(db, "n-1")).toBe("/staff/notifications");
  });

  it("stays on the list for a notice with no record", async () => {
    const { db } = answering({ row: { ...NOTICE_ROW, record_id: null } });

    expect(await openNotification(db, "n-1")).toBe("/staff/notifications");
  });

  it("stays on the list when the notice could not be marked", async () => {
    const { db } = answering({
      error: "mark_notification_read: no notification n-1 addressed to you",
    });

    expect(await openNotification(db, "n-1")).toBe("/staff/notifications");
  });
});
