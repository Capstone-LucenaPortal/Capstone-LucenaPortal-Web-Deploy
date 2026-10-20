/**
 * The gate all four config views open with, once `draft === null` stopped
 * meaning "still loading".
 *
 * The `super_*_config` and `super_site_info` views are gated definer views:
 * they return exactly one row to an active `super_staff` and ZERO rows to
 * anyone else. `.single()` raises that emptiness as PGRST116, which the error
 * seam classifies as `permission`, so the message here says "not authorised"
 * rather than "config missing" — the obligation the wiring design §7.1 puts on
 * the portal. Before this existed the rejection was unhandled and the view
 * showed a spinner forever.
 *
 * Error is checked BEFORE loading, matching `CatalogCard`.
 */
export function ConfigLoadState({ error }: { error: string | null }) {
  if (error) {
    return <p className="mt-6 text-sm text-red-500">{error}</p>;
  }
  return <p className="mt-6 text-sm text-gray-500">Loading&hellip;</p>;
}
