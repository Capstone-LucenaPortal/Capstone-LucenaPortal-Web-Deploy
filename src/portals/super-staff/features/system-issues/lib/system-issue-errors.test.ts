import { describe, expect, it } from "vitest";
import { toRpcError } from "@/portals/super-staff/lib/supabase/errors";
import { systemIssueErrorMessage } from "./system-issue-errors";

// Every message below is the l128 raise text verbatim (header §3 and the
// function bodies), with the `%` placeholders filled in.

const FALLBACK = "Could not save. Try again.";
const say = (code: string, message: string) =>
  systemIssueErrorMessage(toRpcError({ code, message }), FALLBACK);

describe("systemIssueErrorMessage", () => {
  it("says why a move is refused, with the status in words", () => {
    expect(
      say("PT409", "start_system_issue: SI-2026-000031 is in_progress; only an open System issue can be started"),
    ).toBe("SI-2026-000031 is in progress. Only an open System issue can be started.");
    expect(
      say("PT409", "resolve_system_issue: SI-2026-000031 is open; only a System issue in progress can be resolved"),
    ).toBe("SI-2026-000031 is open. Only a System issue in progress can be resolved.");
    expect(
      say(
        "PT409",
        "close_system_issue: SI-2026-000031 is closed; only an open or in-progress System issue can be closed",
      ),
    ).toBe("SI-2026-000031 is closed. Only an open or in-progress System issue can be closed.");
  });

  it("says why priority and category are locked", () => {
    expect(
      say(
        "PT409",
        "triage_system_issue: SI-2026-000031 is resolved; priority and category are locked once a System issue is resolved or closed",
      ),
    ).toBe(
      "SI-2026-000031 is resolved. Priority and category are locked once a System issue is resolved or closed.",
    );
  });

  it("asks for each note, and a reason", () => {
    expect(say("22023", "resolve_system_issue: a resolution note is required, at most 2000 characters")).toBe(
      "Enter a resolution note, at most 2000 characters.",
    );
    expect(say("22023", "close_system_issue: a close note is required, at most 2000 characters")).toBe(
      "Enter a note, at most 2000 characters.",
    );
    expect(say("22023", "close_system_issue: a close reason is required")).toBe("Choose a reason for closing.");
  });

  it("shows any other 22023 without the function name", () => {
    expect(
      say("22023", "triage_system_issue: nothing to change; give a priority, a category or both"),
    ).toBe("Nothing to change; give a priority, a category or both.");
  });

  it("reads PT404 as a stale screen and 42501 as not permitted", () => {
    expect(
      say("PT404", "start_system_issue: no System issue 11111111-1111-1111-1111-111111111111"),
    ).toBe("Not found — this System issue no longer exists. Refresh the page.");
    expect(say("42501", "close_system_issue: caller is not an active Super Staff")).toBe(
      "Not permitted — only an active Super Staff member can work System issues.",
    );
  });

  it("falls back for anything else", () => {
    expect(systemIssueErrorMessage(new Error("network"), FALLBACK)).toBe(FALLBACK);
    expect(say("XX000", "boom")).toBe(FALLBACK);
  });
});
