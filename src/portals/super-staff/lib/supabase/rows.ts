import { RpcError } from "./errors";

/**
 * Narrow a column the generated types call nullable back to a value.
 *
 * ⚠️ Every column of a `super_*` definer view is typed `T | null` — PostgREST
 * cannot know the gate guarantees a row, so it assumes the worst for all of
 * them. The BASE tables behind the singleton config views declare these
 * columns NOT NULL, so once a row has come back, a null is not a value the
 * portal should render around: it means the view and its table have drifted.
 *
 * Wiring design §7.1 puts it as an obligation on the portal — it "must not
 * render a null as `0`". Casting the row to a non-null shape said the same
 * thing by lying to the type system instead; this says it once, out loud, and
 * fails where the drift is rather than three screens later.
 *
 * NOT for genuinely nullable columns. `super_metrics` divides by
 * `nullif(count(*), 0)` and `at_risk_prev` is permanently null by design —
 * those are modelled as `number | null` all the way to the tile, on purpose.
 */
export function requiredColumn<T>(
  value: T | null,
  column: string,
  view: string,
): T {
  if (value === null) {
    throw new RpcError(
      "unexpected",
      `${view}.${column} came back null, but the table declares it NOT NULL.`,
      null,
    );
  }
  return value;
}
