import { describe, expect, it } from "vitest";
import type { SystemIssue } from "../types";
import { queue, SORTS } from "./queue";

const issue = (id: string, createdAt: string, over: Partial<SystemIssue> = {}): SystemIssue => ({
  id,
  reference: `SI-${id}`,
  createdAt,
  category: "website",
  description: "",
  capturedPage: null,
  userAgent: null,
  priority: null,
  status: "open",
  resolvedAt: null,
  resolutionNote: null,
  closesAt: null,
  closedAt: null,
  closeReason: null,
  closeNote: null,
  isOnBehalf: false,
  reporter: "",
  reporterEmail: null,
  screenshotPath: null,
  ...over,
});

// Scrambled on purpose: triage order and date order disagree.
const ISSUES = [
  issue("low-old", "2026-11-01T00:00:00Z", { priority: "low" }),
  issue("high-new", "2026-11-25T00:00:00Z", { priority: "high" }),
  issue("unprioritised-mid", "2026-11-10T00:00:00Z"),
  issue("resolved-newest", "2026-11-26T00:00:00Z", { priority: "high", status: "resolved" }),
];

const ids = (issues: SystemIssue[]) => issues.map((i) => i.id);

describe("queue — sort", () => {
  it("keeps the triage order under Default: not prioritised first, then High → Low", () => {
    expect(ids(queue(ISSUES, "attention", "default"))).toEqual([
      "unprioritised-mid",
      "high-new",
      "low-old",
    ]);
  });

  it("orders by date reported alone under Newest and Oldest", () => {
    expect(ids(queue(ISSUES, "all", "newest"))).toEqual([
      "resolved-newest",
      "high-new",
      "unprioritised-mid",
      "low-old",
    ]);
    expect(ids(queue(ISSUES, "all", "oldest"))).toEqual([
      "low-old",
      "unprioritised-mid",
      "high-new",
      "resolved-newest",
    ]);
  });

  it("still filters to the tab under Newest", () => {
    expect(ids(queue(ISSUES, "attention", "newest"))).toEqual([
      "high-new",
      "unprioritised-mid",
      "low-old",
    ]);
  });

  it("offers Default, Newest reported and Oldest reported, in that order", () => {
    expect(SORTS.map((s) => s.label)).toEqual(["Default", "Newest reported", "Oldest reported"]);
  });
});
