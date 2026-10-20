import { isoToLocalInput, localInputToIso } from "@/portals/super-staff/lib/datetime";
import type { CityEvent, EventInput } from "../types";

/**
 * The editor's form state, and the two pure maps either side of it.
 *
 * ⚠️ Here rather than in the component because of `imagePath`: `update_event`
 * has no argument defaults. OMITTING `p_image_path` does not wipe anything —
 * PostgREST resolves by argument name, so a missing one is `PGRST202` / HTTP
 * 404 and the function is never entered. What wipes is an EXPLICIT null, and
 * this chain is what prevents it: `EMPTY.imagePath` is null, so `toFormValue`
 * seeding it from the loaded row and `toInput` carrying it back out is the
 * whole of that protection — see `form-value.test.ts`, and DB repo
 * `docs/what-not-to-do.md` §10 for the probe.
 */

export type FormValue = {
  title: string;
  description: string;
  locationText: string;
  categoryCode: string;
  /** Seeded from the loaded row; set by ImageField on first upload. */
  imagePath: string | null;
  startLocal: string;
  endLocal: string;
  isPublished: boolean;
};

export const EMPTY: FormValue = {
  title: "",
  description: "",
  locationText: "",
  categoryCode: "",
  imagePath: null,
  startLocal: "",
  endLocal: "",
  isPublished: false,
};

export const toFormValue = (e: CityEvent): FormValue => ({
  title: e.title,
  description: e.description ?? "",
  locationText: e.locationText ?? "",
  categoryCode: e.categoryCode ?? "",
  imagePath: e.imagePath,
  startLocal: isoToLocalInput(e.startAt),
  endLocal: isoToLocalInput(e.endAt),
  isPublished: e.isPublished,
});

/**
 * Only ever called on a value `validateEvent` has already passed, which is what
 * makes the `!` on `startAt` sound: a blank start is a validation error, not a
 * null the database would accept.
 */
export const toInput = (v: FormValue): EventInput => ({
  title: v.title,
  description: v.description.trim() ? v.description : null,
  categoryCode: v.categoryCode || null,
  locationText: v.locationText,
  imagePath: v.imagePath,
  startAt: localInputToIso(v.startLocal)!,
  endAt: localInputToIso(v.endLocal),
  isPublished: v.isPublished,
});
