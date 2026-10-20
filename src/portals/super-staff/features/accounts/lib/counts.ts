import type { Account, Role } from "../types";

export type RoleCounts = Record<Role, number> & { all: number };

const ROLES: Role[] = ["Staff", "Responder", "Admin", "Super Staff"];

/**
 * Per-role counts for the list filter tabs. Respects the active/inactive
 * toggle so tab counts match the rows the toggle actually reveals.
 */
export function computeRoleCounts(
  accounts: Account[],
  includeInactive: boolean,
): RoleCounts {
  const visible = includeInactive
    ? accounts
    : accounts.filter((a) => a.status === "Active");
  const counts = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<
    Role,
    number
  >;
  for (const a of visible) counts[a.role] += 1;
  return { ...counts, all: visible.length };
}
