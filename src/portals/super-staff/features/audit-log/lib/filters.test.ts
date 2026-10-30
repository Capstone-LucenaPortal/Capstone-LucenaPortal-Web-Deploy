import { describe, expect, it } from "vitest";
import type { AuditEntry } from "../types";
import { filterAuditEntries } from "./filters";

const rows: AuditEntry[] = [
  {
    id: "aud-0001",
    timestamp: "2026-07-15T09:14:00+08:00",
    actor: "Maria Santos",
    area: "configuration",
    change: "Critical SLA 4h → 3h",
    target: "Incidents",
    targetId: null,
    sessionId: null,
    ipAddress: null,
    userAgent: null,
  },
  {
    id: "aud-0002",
    timestamp: "2026-07-15T08:52:00+08:00",
    actor: "Maria Santos",
    area: "accounts",
    change: "Created Staff account",
    target: "Ramon Cruz",
    targetId: null,
    sessionId: null,
    ipAddress: null,
    userAgent: null,
  },
  {
    id: "aud-0004",
    timestamp: "2026-07-08T10:20:00+08:00",
    actor: "Maria Santos",
    area: "configuration",
    change: "At-risk threshold 50% → 60%",
    target: "Incidents",
    targetId: null,
    sessionId: null,
    ipAddress: null,
    userAgent: null,
  },
];

describe("filterAuditEntries", () => {
  it("returns everything newest-first when the query is empty", () => {
    const out = filterAuditEntries(rows, {});
    expect(out.map((e) => e.id)).toEqual(["aud-0001", "aud-0002", "aud-0004"]);
  });

  it("treats area 'all' and an omitted area as no filter", () => {
    expect(filterAuditEntries(rows, { area: "all" })).toHaveLength(3);
  });

  it("filters by area", () => {
    expect(
      filterAuditEntries(rows, { area: "configuration" }).map((e) => e.id),
    ).toEqual(["aud-0001", "aud-0004"]);
  });

  it("searches actor and target, case-insensitively", () => {
    expect(filterAuditEntries(rows, { search: "ramon" }).map((e) => e.id)).toEqual(
      ["aud-0002"],
    );
    expect(filterAuditEntries(rows, { search: "SANTOS" })).toHaveLength(3);
  });

  it("applies inclusive from/to bounds", () => {
    const out = filterAuditEntries(rows, {
      fromIso: "2026-07-14T00:00:00+08:00",
      toIso: "2026-07-15T23:59:59+08:00",
    });
    expect(out.map((e) => e.id)).toEqual(["aud-0001", "aud-0002"]);
  });

  it("does not mutate or re-order the input array", () => {
    const input = [...rows];
    filterAuditEntries(input, { area: "accounts" });
    expect(input.map((e) => e.id)).toEqual(["aud-0001", "aud-0002", "aud-0004"]);
  });
});
