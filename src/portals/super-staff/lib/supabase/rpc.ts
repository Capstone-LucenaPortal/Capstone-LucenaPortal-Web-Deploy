import { createClient } from "@/shared/supabase/client";
import { toRpcError } from "./errors";
import type { Database } from "@/shared/supabase/types";

type Fns = Database["public"]["Functions"];
export type FnName = keyof Fns;

/**
 * The generated `Args` never carry `| null`: the codegen cannot see which SQL
 * parameters accept NULL. The update RPCs have NO argument defaults, so clearing
 * a field means sending an explicit null — omitting it is an error, not a clear.
 * Widening the value type (never the key set) keeps the part that matters:
 * argument NAMES and required-ness stay checked against the database.
 */
export type FnArgs<K extends FnName> = {
  [P in keyof Fns[K]["Args"]]: Fns[K]["Args"][P] | null;
};
export type FnReturns<K extends FnName> = Fns[K]["Returns"];

/**
 * The single RPC call site. Callers are fully type-checked against the generated
 * `Args` for the named function — which is the point, because PostgREST arguments
 * are NAMED: under a loose type a `p_openning_hour` typo compiles cleanly and
 * fails at runtime with an opaque error.
 *
 * The internal cast is a generic-variance workaround (the client cannot narrow
 * `args` for a generic `K`), NOT the old `never`-inference bug. It is deliberately
 * confined to this one line.
 */
export async function callRpc<K extends FnName>(
  fn: K,
  args: FnArgs<K>,
): Promise<FnReturns<K>> {
  const { data, error } = await createClient().rpc(fn, args as never);
  if (error) throw toRpcError(error);
  return data as FnReturns<K>;
}
