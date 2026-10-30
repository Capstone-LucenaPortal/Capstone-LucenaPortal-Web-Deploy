import { describe, expect, it } from "vitest";
import { toTimelineItem, toTimelineItems } from "./timeline";
import type { AuditEntry } from "../types";

const entry = (patch: Partial<AuditEntry> = {}): AuditEntry => ({
  id: "44444444-4444-4444-4444-444444444444",
  timestamp: "2026-08-14T08:00:00+08:00",
  actor: "Ana Reyes",
  area: "content",
  change: "Published",
  target: "Water interruption",
  targetId: "11111111-1111-1111-1111-111111111111",
  detail: undefined,
  sessionId: null,
  ipAddress: null,
  userAgent: null,
  ...patch,
});

describe("toTimelineItem", () => {
  it("carries the entry's identity and actor across", () => {
    const item = toTimelineItem(entry());
    expect(item.id).toBe("44444444-4444-4444-4444-444444444444");
    expect(item.timestamp).toBe("2026-08-14T08:00:00+08:00");
    expect(item.actor).toBe("Ana Reyes");
  });

  it("joins a detail to the change with an em dash", () => {
    expect(toTimelineItem(entry({ detail: "Draft → Published" })).summary).toBe(
      "Published — Draft → Published",
    );
  });

  it("leaves no trailing separator when there is no detail", () => {
    // A status flip has nothing to add. "Published — " would read as truncated.
    expect(toTimelineItem(entry({ detail: undefined })).summary).toBe("Published");
  });

  it("treats an empty detail as no detail", () => {
    expect(toTimelineItem(entry({ detail: "" })).summary).toBe("Published");
  });

  it("maps a list in order", () => {
    const items = toTimelineItems([
      entry({ id: "a", change: "Created" }),
      entry({ id: "b", change: "Published" }),
    ]);
    expect(items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(items.map((i) => i.summary)).toEqual(["Created", "Published"]);
  });

  it("maps an empty history to an empty list", () => {
    expect(toTimelineItems([])).toEqual([]);
  });
});
