import type { Announcement, AnnouncementInput, ContentType } from "../types";
import { isoToLocalInput, localInputToIso } from "@/portals/super-staff/lib/datetime";

/**
 * The editor's form state, and the two pure maps either side of it.
 *
 * ⚠️ These live here, not in the editor component, because of `imagePath`.
 * `update_post` declares no argument defaults — but the hazard that creates is
 * NOT the one this comment used to claim. OMITTING `p_image_path` cannot wipe
 * anything: PostgREST resolves an RPC by argument NAMES, so a missing name
 * matches no signature and the call fails with `PGRST202` / HTTP 404, naming
 * the parameter it wanted. The function is never entered and nothing is
 * written.
 *
 * The real hazard is an EXPLICIT null, and this chain is what prevents it.
 * `EMPTY.imagePath` is null, so if `toFormValue` stopped seeding it from the
 * loaded row, `toInput` would carry that null out, `toUpdatePostArgs` would
 * send `p_image_path: null`, and the database cannot tell that apart from
 * "clear this image" — it wipes it, silently, with a 200. The chain is exactly
 * right; only its stated reason was wrong.
 *
 * While both maps sat inside a component, this repo's "Vitest covers pure
 * logic only" rule left that chain untested. `form-value.test.ts` now holds it
 * end to end. DB repo `docs/what-not-to-do.md` §10 carries the live probe.
 */

// Form value carries datetime-local strings; converted to/from ISO at the seam.
export type FormValue = {
  contentType: ContentType;
  title: string;
  body: string;
  categoryCode: string;
  /** Seeded from the loaded row; set by ImageField on first upload. */
  imagePath: string | null;
  startLocal: string;
  endLocal: string;
};

export const EMPTY: FormValue = {
  contentType: "announcement",
  title: "",
  body: "",
  categoryCode: "",
  imagePath: null,
  startLocal: "",
  endLocal: "",
};

export const toFormValue = (a: Announcement): FormValue => ({
  contentType: a.contentType,
  title: a.title,
  body: a.body,
  categoryCode: a.categoryCode ?? "",
  imagePath: a.imagePath,
  startLocal: isoToLocalInput(a.startAt),
  endLocal: isoToLocalInput(a.endAt),
});

export const toInput = (v: FormValue): AnnouncementInput => ({
  contentType: v.contentType,
  title: v.title,
  body: v.body,
  categoryCode: v.categoryCode || null,
  imagePath: v.imagePath,
  startAt: localInputToIso(v.startLocal),
  endAt: localInputToIso(v.endLocal),
});
