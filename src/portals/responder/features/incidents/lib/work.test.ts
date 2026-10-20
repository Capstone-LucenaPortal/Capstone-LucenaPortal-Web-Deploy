import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  furthestStage,
  resolvedHeadline,
  slaMarginMs,
  timeOfDay,
} from "@/portals/responder/features/incidents/lib/work";
import { anEvent, anIncident } from "@/portals/responder/features/incidents/lib/fixtures";

/**
 * WHAT LEFT THIS FILE IN THE CUTOVER, and where it is asserted now. Every one
 * was a rule this app could only pretend to enforce; each is a database object
 * with its own assertion in the DB repo (assert_l56.sql, assert_l56_behaviour.sql):
 *
 *   advanceStage monotonicity (6)  -> trg_stage_monotonic
 *   addNote trimming and caps (5)  -> add_incident_note (l22)
 *   addPhoto / removePhotoAt  (5)  -> request_incident_photo_upload's cycle cap
 *   the photo gate            (3)  -> resolve_incident's confirmed-photo gate
 *   pushFinished trimming     (2)  -> responder_history
 *
 * 21 tests deleted. What is left is presentation, and it is still tested here
 * because presentation is still this repo's job.
 */

const AT_0900 = new Date("2026-07-28T09:00:00+08:00");

describe("timeOfDay", () => {
  it("reads as a Manila wall clock whatever the machine's timezone", () => {
    expect(timeOfDay("2026-07-28T09:15:00+08:00")).toBe("9:15 AM");
    expect(timeOfDay("2026-07-28T14:05:00+08:00")).toBe("2:05 PM");
    expect(timeOfDay("2026-07-28T00:07:00+08:00")).toBe("12:07 AM");
    expect(timeOfDay("2026-07-28T12:00:00+08:00")).toBe("12:00 PM");
  });
});

describe("furthestStage", () => {
  const stage = (type: string, at: string) =>
    anEvent({
      event_type: type as never,
      created_at: `2026-07-28T${at}:00+08:00`,
    });

  it("reports no stage reached on a freshly claimed ticket", () => {
    expect(furthestStage([anEvent({ event_type: "claimed" })])).toBe(-1);
  });

  it("finds the furthest stage, not the latest event", () => {
    // A note posted after "on site" must not drag the tracker backwards.
    const events = [
      stage("stage_en_route", "09:15"),
      stage("stage_on_site", "09:30"),
      anEvent({ event_type: "note", created_at: "2026-07-28T09:40:00+08:00" }),
    ];
    expect(furthestStage(events)).toBe(1);
  });

  it("counts a skipped-ahead stage at its own index", () => {
    // Arriving before you remembered to tap "en route" is the real failure.
    expect(furthestStage([stage("stage_working", "09:15")])).toBe(2);
  });

  it("ignores events that are not stages", () => {
    expect(
      furthestStage([
        anEvent({ event_type: "submitted" }),
        anEvent({ event_type: "routed" }),
        anEvent({ event_type: "resolved" }),
      ]),
    ).toBe(-1);
  });
});

describe("buildTimeline", () => {
  /**
   * Rewritten over IncidentEvent[]. The old version derived the timeline from a
   * cookie and had to SYNTHESISE the claim row; `claimed` is a real event now,
   * so nothing is invented and this is the same thread the Staff portal reads.
   */
  const at = (time: string) => `2026-07-28T${time}:00+08:00`;

  const events = [
    anEvent({ event_type: "claimed", actor_name: "Juan", created_at: at("09:00") }),
    anEvent({
      event_type: "stage_en_route",
      actor_name: "Juan",
      created_at: at("09:15"),
    }),
    anEvent({
      event_type: "note",
      note: "Traffic on Quezon Ave",
      actor_name: "Juan",
      created_at: at("09:30"),
    }),
    anEvent({
      event_type: "photo_added",
      actor_name: "Juan",
      created_at: at("09:40"),
    }),
  ];

  it("renders one entry per event, in the order the query returned them", () => {
    expect(buildTimeline(events).map((e) => e.title)).toEqual([
      "Claimed",
      "En route",
      "Traffic on Quezon Ave",
      "After photo added",
    ]);
  });

  it("names the time and one accountable person on every entry", () => {
    // PRD §5 — the audit trail always names someone.
    for (const entry of buildTimeline(events)) {
      expect(entry.meta).toContain("Juan");
    }
    expect(buildTimeline(events)[0].meta).toBe("9:00 AM · Juan");
  });

  it("renders a note's own text as its title and labels it in the meta", () => {
    const note = buildTimeline(events).find(
      (e) => e.title === "Traffic on Quezon Ave",
    )!;

    expect(note.meta).toBe("9:30 AM · Juan · Note");
  });

  it("names whoever acted, not the reader — a supervisor's force-release included", () => {
    // The old version stamped the session's own first name on every row, so a
    // colleague's work and a supervisor's intervention both read as yours.
    const [entry] = buildTimeline([
      anEvent({
        event_type: "force_released",
        actor_role: "supervisor",
        actor_name: "Juan Dela Cruz",
        created_at: at("11:00"),
      }),
    ]);

    expect(entry.title).toBe("Returned to the pool by a supervisor");
    expect(entry.meta).toContain("Juan Dela Cruz");
  });

  it("carries the citizen's and staff's events on the same thread", () => {
    const titles = buildTimeline([
      anEvent({ event_type: "submitted", actor_name: "Maria" }),
      anEvent({ event_type: "verified", actor_name: "Staff" }),
      anEvent({ event_type: "routed", actor_name: "Staff" }),
    ]).map((e) => e.title);

    expect(titles).toEqual([
      "Reported by the citizen",
      "Verified by staff",
      "Routed to your department",
    ]);
  });

  it("is empty on a ticket with no events rather than inventing one", () => {
    expect(buildTimeline([])).toHaveLength(0);
  });

  it("drops an event with no timestamp instead of rendering an Invalid Date", () => {
    expect(buildTimeline([anEvent({ created_at: null })])).toHaveLength(0);
  });
});

describe("the SLA margin", () => {
  const armed = anIncident({
    sla_armed_at: "2026-07-28T09:00:00+08:00",
    sla_due_at: "2026-07-28T13:00:00+08:00",
  });

  it("is positive when the promise is still ahead", () => {
    expect(slaMarginMs(armed, new Date("2026-07-28T09:08:00+08:00"))).toBe(
      (3 * 60 + 52) * 60_000,
    );
  });

  it("is negative once the promise is past", () => {
    expect(slaMarginMs(armed, new Date("2026-07-28T13:55:00+08:00"))).toBe(
      -55 * 60_000,
    );
  });

  it("is null when no clock was ever running", () => {
    const unverified = anIncident({ is_verified: false, sla_due_at: null });
    expect(slaMarginMs(unverified, AT_0900)).toBeNull();
  });
});

describe("resolvedHeadline", () => {
  it("counts the time you saved", () => {
    expect(resolvedHeadline((2 * 60 + 14) * 60_000)).toBe(
      "Resolved with 2h 14m to spare",
    );
  });

  it("counts the time you went over", () => {
    expect(resolvedHeadline(-40 * 60_000)).toBe("Resolved 40m over");
  });

  it("says plainly that there was no promise to keep", () => {
    expect(resolvedHeadline(null)).toBe("Resolved — no SLA was running");
  });
});
