import { vi } from "vitest";
import * as profile from "./profile";

/**
 * Test-only. Stubs the one profile read with an active staff row assigned
 * these modules, so a page's module gate runs through the real mapper — the
 * path the sidebar's list takes.
 *
 * `modules` is the DATABASE spelling: "yellow_card", never "yellow-card". The
 * mapper silently drops an unknown code, so the wrong spelling reads as an
 * unassigned module rather than a broken fixture.
 */
export function stubProfileRow(modules: string[] | null) {
  return vi.spyOn(profile, "getMyProfileRow").mockResolvedValue({
    id: "11111111-1111-1111-1111-111111111111",
    full_name: "Juan Dela Cruz",
    email: "juan.delacruz@lucenacity.gov.ph",
    role: "staff",
    modules,
    is_supervisor: false,
    status: "active",
    department_label: "Yellow Card Office",
    created_at: "2026-01-15T08:00:00.000Z",
  });
}
