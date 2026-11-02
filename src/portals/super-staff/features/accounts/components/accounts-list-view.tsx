"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Modal } from "@/portals/super-staff/components/ui/modal";
import { useToast } from "@/portals/super-staff/components/providers/toast-provider";
import { cn } from "@/portals/super-staff/lib/utils";
import { useSignedInId } from "../hooks/use-signed-in-id";
import { computeRoleCounts } from "../lib/counts";
import { resetAuthenticator } from "../lib/invite";
import { listAccounts } from "../lib/queries";
import type { Account, Role } from "../types";
import { RoleBadge, StatusBadge, SupervisorBadge } from "./account-badges";

type Tab = "all" | Role;
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Staff", label: "Staff" },
  { key: "Responder", label: "Responders" },
  { key: "Admin", label: "Admin" },
  { key: "Super Staff", label: "Super Staff" },
];

export function AccountsListView() {
  const { toast } = useToast();
  const [all, setAll] = useState<Account[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  // Until it arrives, or if the read fails, no row offers the reset: unlike
  // the Role lock, a wrong guess here would offer one on one's own row.
  // staff-accounts refuses a reset of the caller regardless.
  const signedInId = useSignedInId();
  const [resetTarget, setResetTarget] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);

  // Unfiltered load drives the tab counts; the view returns every row a Super
  // Staff may see and the tabs, search and "show inactive" all filter it here.
  useEffect(() => {
    let active = true;
    setLoading(true);
    listAccounts().then((rows) => {
      if (active) {
        setAll(rows);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(
    () => computeRoleCounts(all, includeInactive),
    [all, includeInactive],
  );

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return all.filter((a) => {
      if (!includeInactive && a.status === "Inactive") return false;
      if (tab !== "all" && a.role !== tab) return false;
      if (
        needle &&
        !a.fullName.toLowerCase().includes(needle) &&
        !a.email.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [all, tab, search, includeInactive]);

  async function handleReset() {
    if (!resetTarget) return;
    setBusy(true);
    try {
      const result = await resetAuthenticator(resetTarget.id);
      // Not recorded still means reset: the Super Staff needs the function's
      // message to report the gap, and the dialog closes either way, since a
      // second confirm would only be told there is nothing to reset.
      toast(
        result.recorded
          ? `${resetTarget.fullName}'s authenticator was reset. They'll set up a new one at their next sign-in.`
          : result.warning,
        result.recorded ? "success" : "warning",
      );
      setResetTarget(null);
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not reset the authenticator.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  const countFor = (key: Tab) => (key === "all" ? counts.all : counts[key]);

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-lucena-blue">Accounts</h1>
          <p className="text-gray-500 mt-2">
            Provision and manage internal portal access.
          </p>
        </div>
        <Link href="/super-staff/accounts/new">
          <Button variant="primary">+ New account</Button>
        </Link>
      </div>

      <div className="mt-6 flex items-center justify-between border-b border-gray-200">
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium",
                tab === t.key
                  ? "border-lucena-blue text-lucena-blue"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              )}
            >
              {t.label} ({countFor(t.key)})
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="h-4 w-4 accent-lucena-blue"
          />
          Show inactive
        </label>
      </div>

      <input
        type="search"
        aria-label="Search accounts"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name or email…"
        className="mt-4 w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
      />

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 font-medium text-gray-500">Email</th>
              <th className="px-4 py-3 font-medium text-gray-500">Role</th>
              <th className="px-4 py-3 font-medium text-gray-500">Modules</th>
              <th className="px-4 py-3 font-medium text-gray-500">Sup</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No accounts match your search.
                </td>
              </tr>
            ) : (
              rows.map((a) => (
                <tr
                  key={a.id}
                  className={cn(
                    "border-b border-gray-100 last:border-0",
                    a.status === "Inactive" && "bg-gray-50 text-gray-500",
                  )}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {a.fullName}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{a.email}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={a.role} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {a.role === "Staff" && a.modules.length > 0
                      ? a.modules.join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {a.role === "Staff" && a.isSupervisor ? (
                      <SupervisorBadge />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {/* A Super-staff's own reset is done by another
                        Super-staff, or on the Supabase dashboard (ADR 0009). */}
                    {signedInId !== null && a.id !== signedInId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mr-2"
                        onClick={() => setResetTarget(a)}
                      >
                        Reset authenticator
                      </Button>
                    )}
                    <Link
                      href={`/super-staff/accounts/${a.id}`}
                      className="inline-flex h-8 items-center justify-center rounded-md bg-lucena-blue px-3 text-sm font-medium text-white hover:bg-lucena-blue-dark"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && (
        <p className="mt-3 text-sm text-gray-500">
          Showing {rows.length} of {counts.all} results.
        </p>
      )}

      <Modal open={resetTarget !== null} onClose={() => setResetTarget(null)}>
        <h3 className="text-lg font-semibold text-gray-900">
          Reset this authenticator?
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          {resetTarget?.fullName} ({resetTarget?.email}) will no longer be able
          to sign in with their current authenticator, and will set up a new one
          at their next sign-in. This is recorded in the audit log under your
          name.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setResetTarget(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleReset} disabled={busy}>
            Reset authenticator
          </Button>
        </div>
      </Modal>
    </div>
  );
}
