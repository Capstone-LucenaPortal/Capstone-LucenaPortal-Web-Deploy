import { describe, expect, it } from "vitest";
import { CONTACT_STATUSES, countUnread, statusLabel } from "./status";
import type { ContactMessage } from "../types";

const msg = (status: ContactMessage["status"]): ContactMessage => ({
  id: crypto.randomUUID(),
  name: "Juan",
  email: "juan@example.com",
  message: "Hello",
  status,
  handledByName: null,
  handledAt: null,
  createdAt: "2026-08-01T08:00:00+08:00",
});

describe("contact statuses", () => {
  it("matches the check constraint exactly", () => {
    expect(CONTACT_STATUSES).toEqual(["new", "read", "archived"]);
  });

  it("labels each status", () => {
    expect(statusLabel("new")).toBe("New");
    expect(statusLabel("read")).toBe("Read");
    expect(statusLabel("archived")).toBe("Archived");
  });
});

describe("countUnread", () => {
  it("counts only new messages", () => {
    expect(countUnread([msg("new"), msg("new"), msg("read"), msg("archived")]))
      .toBe(2);
  });

  it("is zero for an empty inbox", () => {
    expect(countUnread([])).toBe(0);
  });
});
