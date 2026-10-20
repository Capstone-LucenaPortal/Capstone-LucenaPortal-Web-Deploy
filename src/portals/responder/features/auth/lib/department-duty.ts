import { cache } from "react";
import { createClient } from "@/shared/supabase/server";

/** How many responders in your own department are on duty right now. */
export type DepartmentDuty = { onDuty: number; total: number };

type DutyRow = {
  department_code: string | null;
  department_label: string | null;
  on_duty_count: number | null;
  total_count: number | null;
};

/**
 * Reads responder_department_duty (l51), which self-scopes to the caller's own
 * department through auth.uid().
 *
 * Returns null — not { onDuty: 0, total: 0 } — when there is no row. A
 * non-responder, a deactivated responder and an anonymous caller all get zero
 * rows, and "no count available" is a different fact from "nobody is on duty".
 * Rendering the second when we mean the first would tell a responder their
 * whole department has gone home.
 */
export const getDepartmentDuty = cache(
  async (): Promise<DepartmentDuty | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("responder_department_duty")
      .select("department_code, department_label, on_duty_count, total_count")
      .maybeSingle();

    // Same row cast as profile.ts: it narrows the view's nullable columns.
    // Compile-time only.
    const row = (data as DutyRow | null) ?? null;
    if (!row || row.total_count === null) return null;

    return { onDuty: row.on_duty_count ?? 0, total: row.total_count };
  },
);
