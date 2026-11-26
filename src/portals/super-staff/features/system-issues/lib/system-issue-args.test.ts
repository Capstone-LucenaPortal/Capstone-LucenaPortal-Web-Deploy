import { describe, expect, it } from "vitest";
import {
  toCloseSystemIssueArgs,
  toLogSystemIssueOnBehalfArgs,
  toResolveSystemIssueArgs,
  toStartSystemIssueArgs,
  toTriageSystemIssueArgs,
} from "./system-issue-args";

// The four Super-staff RPCs have NO argument defaults (l128 header §2.4): an
// omitted name is a PGRST202 404. Each builder must produce exactly the
// declared argument set — asserted with toEqual, which fails on a missing key.

const ID = "11111111-1111-1111-1111-111111111111";

describe("toTriageSystemIssueArgs", () => {
  it("sends a new priority, with the category as null to leave it unchanged", () => {
    expect(toTriageSystemIssueArgs(ID, { priority: "high" })).toEqual({
      p_id: ID,
      p_priority: "high",
      p_category: null,
    });
  });

  it("sends a new category, with the priority as null to leave it unchanged", () => {
    expect(toTriageSystemIssueArgs(ID, { category: "lcc" })).toEqual({
      p_id: ID,
      p_priority: null,
      p_category: "lcc",
    });
  });
});

describe("toStartSystemIssueArgs", () => {
  it("builds exactly what start_system_issue declares", () => {
    expect(toStartSystemIssueArgs(ID)).toEqual({ p_id: ID });
  });
});

describe("toResolveSystemIssueArgs", () => {
  it("builds exactly what resolve_system_issue declares, the note trimmed", () => {
    expect(toResolveSystemIssueArgs(ID, "  Cleared the stuck calendar cache.\n")).toEqual({
      p_id: ID,
      p_note: "Cleared the stuck calendar cache.",
    });
  });
});

describe("toCloseSystemIssueArgs", () => {
  it("builds exactly what close_system_issue declares, for each reason", () => {
    expect(toCloseSystemIssueArgs(ID, "duplicate", " Same as SI-2026-000030. ")).toEqual({
      p_id: ID,
      p_reason: "duplicate",
      p_note: "Same as SI-2026-000030.",
    });
    expect(toCloseSystemIssueArgs(ID, "not_a_system_issue", "Report the pothole on the incident page.")).toEqual({
      p_id: ID,
      p_reason: "not_a_system_issue",
      p_note: "Report the pothole on the incident page.",
    });
  });
});

describe("toLogSystemIssueOnBehalfArgs", () => {
  it("sends the email, the part of the website and what they said, trimmed as the database trims", () => {
    expect(
      toLogSystemIssueOnBehalfArgs({
        email: "  juan@example.com\n",
        category: "accounts",
        description: "\tThe sign-in code never arrives. \r\n",
      }),
    ).toEqual({
      p_email: "juan@example.com",
      p_category: "accounts",
      p_description: "The sign-in code never arrives.",
    });
  });
});
