import type { Account } from "../types";

/**
 * True when deactivating (or demoting) this account would leave the portal
 * with no active Super Staff. `activeSuperStaffCount` is the count *including*
 * this account, as returned by `countActiveSuperStaff()`.
 */
export function isLastActiveSuperStaff(
  account: Account,
  activeSuperStaffCount: number,
): boolean {
  return (
    account.role === "Super Staff" &&
    account.status === "Active" &&
    activeSuperStaffCount <= 1
  );
}
