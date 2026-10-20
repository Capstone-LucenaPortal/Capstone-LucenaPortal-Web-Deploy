import {
  getBookingStatusVariant,
  getCategoryBarClass,
  getEventTypeBarClass,
  getIncidentLevelVariant,
  getIncidentStatusVariant,
  getSlaVariant,
  getYellowCardStatusVariant,
} from "@/portals/admin/lib/status-colors";

// These functions are keyed on the enum CODE (incident_status, incident_level,
// yellow_card_application_status, booking_status), not the human display
// label — a label rename in src/portals/admin/lib/status-labels.ts must never affect the
// badge variant. Each domain gets its own function rather than one flat
// Record<string, Tone>, because some codes repeat across domains with the
// same spelling but a different intended variant (e.g. "pending" exists on
// both YellowCardStatusValue and BookingStatusValue). Each function returns
// one of Badge's own five variants ("default" | "success" | "warning" |
// "destructive" | "info" — see src/portals/admin/components/ui/badge.tsx), not a literal
// Tailwind className.

describe("getIncidentStatusVariant", () => {
  // Aligned with Staff's canonical STATUS_BADGE_VARIANT
  // (src/portals/admin/features/incidents/lib/status.ts): open/in_progress -> info,
  // in_pool -> warning, resolved -> success. Admin's classification of
  // "open" used to be yellow/warning; this task moved it to info to match
  // Staff.
  it("returns info for open and in_progress", () => {
    expect(getIncidentStatusVariant("open")).toBe("info");
    expect(getIncidentStatusVariant("in_progress")).toBe("info");
  });

  it("returns warning for in_pool", () => {
    expect(getIncidentStatusVariant("in_pool")).toBe("warning");
  });

  it("returns success for resolved", () => {
    expect(getIncidentStatusVariant("resolved")).toBe("success");
  });

  // No entry on purpose: closure_reason may or may not mean the underlying
  // problem was actually resolved, so it falls through to the neutral
  // default variant rather than reading as unconditionally positive.
  it("falls back to default for closed", () => {
    expect(getIncidentStatusVariant("closed")).toBe("default");
  });

  it("does not resolve a human label — this map is keyed on code", () => {
    expect(getIncidentStatusVariant("Awaiting Triage" as never)).toBe("default");
  });
});

describe("getIncidentLevelVariant", () => {
  // Aligned with Staff's canonical LEVEL_BADGE_VARIANT
  // (src/portals/admin/features/incidents/lib/status.ts): critical -> destructive,
  // high -> warning, medium -> info, low -> default. Admin previously
  // classified high as red and medium as yellow and low as green — this is
  // the mismatch the plan calls out by name (incident_level.high: red in
  // Admin vs amber/warning in Staff) and this task's whole point is to
  // align with Staff.
  it("returns destructive for critical", () => {
    expect(getIncidentLevelVariant("critical")).toBe("destructive");
  });

  it("returns warning for high, matching Staff's classification", () => {
    expect(getIncidentLevelVariant("high")).toBe("warning");
  });

  it("returns info for medium, matching Staff's classification", () => {
    expect(getIncidentLevelVariant("medium")).toBe("info");
  });

  it("returns default for low, matching Staff's classification", () => {
    expect(getIncidentLevelVariant("low")).toBe("default");
  });
});

describe("getYellowCardStatusVariant", () => {
  // Aligned with Staff's canonical STATUS_BADGE_VARIANT
  // (src/portals/admin/features/yellow-card/lib/status.ts): pending -> default,
  // resubmitted -> info, revision_requested -> warning, approved -> success,
  // rejected -> destructive, withdrawn -> default. Admin previously
  // classified pending and resubmitted as yellow — moved to default/info
  // respectively to match Staff.
  it("returns default for pending, matching Staff's classification", () => {
    expect(getYellowCardStatusVariant("pending")).toBe("default");
  });

  it("returns info for resubmitted, matching Staff's classification", () => {
    expect(getYellowCardStatusVariant("resubmitted")).toBe("info");
  });

  it("returns warning for revision_requested", () => {
    expect(getYellowCardStatusVariant("revision_requested")).toBe("warning");
  });

  it("returns success for approved", () => {
    expect(getYellowCardStatusVariant("approved")).toBe("success");
  });

  it("returns destructive for rejected", () => {
    expect(getYellowCardStatusVariant("rejected")).toBe("destructive");
  });

  // Withdrawn is the citizen's own doing, not a refusal — falls through to
  // the neutral default variant, same as before this rework.
  it("falls back to default for withdrawn", () => {
    expect(getYellowCardStatusVariant("withdrawn")).toBe("default");
  });
});

describe("getBookingStatusVariant", () => {
  // Bookings have no Staff sibling to reconcile against, so this
  // classification is unchanged from before this rework — only re-expressed
  // as a variant instead of a literal className.
  it("returns warning for pending, awaiting_quote, and awaiting_payment", () => {
    expect(getBookingStatusVariant("pending")).toBe("warning");
    // SCRUM-198's two Tier Review statuses are awaiting-something too.
    expect(getBookingStatusVariant("awaiting_tier_review")).toBe("warning");
    expect(getBookingStatusVariant("awaiting_resubmission")).toBe("warning");
    expect(getBookingStatusVariant("awaiting_quote")).toBe("warning");
    expect(getBookingStatusVariant("awaiting_payment")).toBe("warning");
  });

  it("returns info for payment_verification and confirmed", () => {
    expect(getBookingStatusVariant("payment_verification")).toBe("info");
    expect(getBookingStatusVariant("confirmed")).toBe("info");
  });

  it("returns success for fully_paid and completed", () => {
    expect(getBookingStatusVariant("fully_paid")).toBe("success");
    expect(getBookingStatusVariant("completed")).toBe("success");
  });

  it("returns destructive for cancelled", () => {
    expect(getBookingStatusVariant("cancelled")).toBe("destructive");
  });
});

describe("getSlaVariant", () => {
  it("returns success for met (On time)", () => {
    expect(getSlaVariant(true)).toBe("success");
  });

  it("returns destructive for not met (Breached)", () => {
    expect(getSlaVariant(false)).toBe("destructive");
  });

  it("returns default for null (Unknown)", () => {
    expect(getSlaVariant(null)).toBe("default");
  });
});

// These maps used to live in the page files keyed by the human LABEL
// ("Infrastructure", "Wedding") that public_incident_categories /
// public_booking_event_types return. Labels are editable catalog data; codes
// are the stable identity the analytics views actually carry
// (admin_incident_analytics.category_code, admin_booking_analytics
// .event_type_code). Keying on the label meant renaming a category in the
// catalog silently dropped its panel bar to the neutral gray fallback.
describe("getCategoryBarClass", () => {
  // The full current incident_categories catalog (see
  // supabase/migrations/20260728233438_l09_seed_catalogs.sql in the DB
  // repo) is exactly these four codes — "health_services" belongs to the
  // unrelated platform_post_categories catalog, not this one.
  it("resolves each real public_incident_categories code to a distinct bar class", () => {
    const codes = ["infrastructure", "public_safety", "sanitation", "environmental"];
    const classes = codes.map(getCategoryBarClass);

    expect(new Set(classes).size).toBe(codes.length);
    expect(classes).not.toContain("bg-gray-500");
  });

  it("falls back to neutral gray for a code it does not know", () => {
    expect(getCategoryBarClass("uncategorized")).toBe("bg-gray-500");
  });

  // The regression guard: a label passed in where a code belongs must NOT
  // resolve, or the map has quietly gone back to being label-keyed.
  it("does not resolve a human label — this map is keyed on code", () => {
    expect(getCategoryBarClass("Public Safety")).toBe("bg-gray-500");
  });
});

describe("getEventTypeBarClass", () => {
  it("resolves each real public_booking_event_types code to a distinct bar class", () => {
    const codes = ["wedding", "conference", "concert", "sports", "religious", "other"];
    const classes = codes.map(getEventTypeBarClass);

    expect(new Set(classes).size).toBe(codes.length);
    expect(classes).not.toContain("bg-gray-500");
  });

  it("falls back to neutral gray for a code it does not know", () => {
    expect(getEventTypeBarClass("uncategorized")).toBe("bg-gray-500");
  });

  it("does not resolve a human label — this map is keyed on code", () => {
    expect(getEventTypeBarClass("Wedding")).toBe("bg-gray-500");
  });
});
