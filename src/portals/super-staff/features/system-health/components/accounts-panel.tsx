import { formatSeconds } from "../lib/format";
import type { PlatformSections } from "../types";
import { Panel } from "./panel";

/** The staff-account figures behind the Accounts checks. Counts only, never a name. */
export function AccountsPanel({ accounts }: { accounts: PlatformSections["accounts"] }) {
  const { detail } = accounts;
  const t = detail.thresholds;
  const invitations = accounts.checks.find((c) => c.key === "unaccepted_invitations");
  const oldest = invitations?.oldest_seconds ?? null;
  const rows: Array<[string, string]> = [
    ["Staff sign-ins (24 h)", String(detail.sign_ins_24h)],
    ["Password-recovery requests (last hour)", String(detail.recovery_requests_1h)],
    ["Super-staff accounts that have signed in", String(detail.active_super_staff)],
    [
      `Invitations unaccepted after ${formatSeconds(t.invitation_age_seconds)}`,
      oldest === null
        ? String(detail.unaccepted_invitations)
        : `${detail.unaccepted_invitations}, the oldest ${formatSeconds(oldest)}`,
    ],
  ];
  return (
    <Panel title="Staff accounts">
      <dl className="divide-y divide-gray-100 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-5 py-2">
            <dt className="text-gray-500">{label}</dt>
            <dd className="text-right tabular-nums text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
