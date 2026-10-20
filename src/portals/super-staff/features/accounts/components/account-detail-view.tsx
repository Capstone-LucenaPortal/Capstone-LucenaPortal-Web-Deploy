"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/portals/super-staff/components/ui/card";
import {
  HistoryTimeline,
  type TimelineItem,
} from "@/portals/super-staff/components/ui/history-timeline";
import { Modal } from "@/portals/super-staff/components/ui/modal";
import { useToast } from "@/portals/super-staff/components/providers/toast-provider";
import { formatDate } from "@/portals/super-staff/lib/utils";
import { createClient } from "@/shared/supabase/client";
import { Input } from "@/portals/super-staff/components/ui/input";
import { isLastActiveSuperStaff } from "../lib/guards";
import { resendSignInLink } from "../lib/invite";
import { toUpdateArgs, type UpdateRpcArgs } from "../lib/update-args";
import {
  countActiveSuperStaff,
  getAccount,
  getAccountHistory,
  listAccounts,
} from "../lib/queries";
import { validateAccount, type FieldErrors } from "../lib/validation";
import type { Account } from "../types";
import { AccountFormFields, type AccountFormValue } from "./account-form-fields";
import { RoleBadge, StatusBadge } from "./account-badges";

// The three responder fields must be carried, not dropped: opening a Responder
// and saving would otherwise blank them and violate responder_fields_required.
const toFormValue = (a: Account): AccountFormValue => ({
  fullName: a.fullName,
  email: a.email,
  role: a.role,
  modules: a.modules,
  isSupervisor: a.isSupervisor,
  departmentCode: a.departmentCode,
  phone: a.phone,
  employeeId: a.employeeId,
});

export function AccountDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [account, setAccount] = useState<Account | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [value, setValue] = useState<AccountFormValue | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [history, setHistory] = useState<TimelineItem[]>([]);
  const [superStaffCount, setSuperStaffCount] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  const [activeOpen, setActiveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const found = await getAccount(id);
    if (!found) {
      setNotFound(true);
      return;
    }
    setAccount(found);
    setValue(toFormValue(found));
    setSuperStaffCount(await countActiveSuperStaff());
    // By id, not by name: a rename must not orphan an account's history.
    setHistory(await getAccountHistory(found.id));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (notFound) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-lucena-blue">Account not found</h1>
        <p className="text-gray-500 mt-2">
          This account does not exist.{" "}
          <button
            onClick={() => router.push("/super-staff/accounts")}
            className="text-lucena-blue hover:text-lucena-blue-dark"
          >
            Back to accounts
          </button>
        </p>
      </div>
    );
  }

  if (!account || !value) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  const blockedDeactivate = isLastActiveSuperStaff(account, superStaffCount);
  const isActive = account.status === "Active";

  async function handleSave() {
    if (!account || !value) return;
    const rows = await listAccounts();
    const others = rows
      .filter((a) => a.id !== account.id)
      .map((a) => a.email);
    const found = validateAccount(value, others);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast("Fix the highlighted fields.", "error");
      return;
    }
    setBusy(true);
    try {
      // No actor argument: update_staff_account takes auth.uid() from the
      // caller's JWT and writes the audit row itself via write_audit.
      //
      // The cast covers one gap and nothing else: the type generator emits
      // params with SQL defaults as optional (`p_phone?: string`) but never as
      // nullable, so it cannot express `text default null`. We send explicit
      // nulls on purpose — changing a Responder to any other role must CLEAR
      // those columns rather than lean on a default (update-args.test.ts:57).
      // Every other field here is fully type-checked.
      const { error } = await createClient().rpc(
        "update_staff_account",
        toUpdateArgs(account.id, value) as UpdateRpcArgs,
      );
      if (error) throw new Error(error.message);
      toast("Changes saved.", "success");
      await load();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not save changes.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (!account) return;
    setBusy(true);
    try {
      const result = await resendSignInLink(account.id);
      toast(`A new sign-in link was sent to ${result.sent_to}.`, "success");
      setResetOpen(false);
      await load();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not send the link.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive() {
    if (!account) return;
    const next = account.status !== "Active";
    if (!reason.trim()) {
      toast("A reason is required.", "error");
      return;
    }
    setBusy(true);
    try {
      const { error } = await createClient().rpc("set_staff_account_status", {
        p_id: account.id,
        p_status: next ? "active" : "inactive",
        p_reason: reason.trim(),
      });
      if (error) throw new Error(error.message);
      toast(next ? "Account reactivated." : "Account deactivated.", "success");
      setActiveOpen(false);
      setReason("");
      await load();
    } catch (error) {
      // The database's own message — "you cannot deactivate your own account",
      // "this is the last active Super Staff…" — is far more useful than
      // anything this component could invent.
      toast(
        error instanceof Error ? error.message : "Could not change the status.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-lucena-blue">
            {account.fullName}
          </h1>
          <p className="text-gray-500 mt-2">
            {account.role} account · created {formatDate(account.createdAt)}
          </p>
        </div>
        <StatusBadge status={account.status} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <AccountFormFields
                value={value}
                errors={errors}
                onChange={setValue}
                emailReadOnly
              />
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => router.push("/super-staff/accounts")}
                >
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={busy}>
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MetaRow label="Role">
                <RoleBadge role={account.role} />
              </MetaRow>
              <MetaRow label="Status">
                <StatusBadge status={account.status} />
              </MetaRow>
              <MetaRow label="Created">
                <span className="text-sm text-gray-900">
                  {formatDate(account.createdAt)}
                </span>
              </MetaRow>
              <MetaRow label="Last change">
                <span className="text-sm text-gray-900">
                  {formatDate(account.lastChangeAt)}
                </span>
              </MetaRow>
              {/* Two separate facts, and neither is an onboarding milestone.
                  This used to read "Accepted <date>", which was wrong twice
                  over: last_sign_in_at is set when the LINK IS OPENED, not
                  when a password is chosen — and it is then updated on every
                  subsequent sign-in, so the "acceptance" date silently slid
                  forward for as long as the person kept using the portal.
                  Whether setup actually completed is NOT observable: GoTrue
                  writes a password hash the moment the link is verified, so a
                  stranded account is indistinguishable from a healthy one.
                  Nothing here may imply otherwise. */}
              {account.invitedAt && (
                <MetaRow label="Invited">
                  <span className="text-sm text-gray-900">
                    {formatDate(account.invitedAt)}
                  </span>
                </MetaRow>
              )}
              <MetaRow label="Last sign-in">
                <span className="text-sm text-gray-900">
                  {account.lastSignInAt
                    ? formatDate(account.lastSignInAt)
                    : "Never signed in"}
                </span>
              </MetaRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <HistoryTimeline items={history} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Not destructive: nothing is invalidated. The employee gets a
                  link and chooses their own password; the old one keeps
                  working until they do. */}
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setResetOpen(true)}
              >
                Send a new sign-in link
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setActiveOpen(true)}
              >
                {isActive ? "Deactivate" : "Reactivate"}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)}>
        <h3 className="text-lg font-semibold text-gray-900">
          Send a new sign-in link?
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          {account.email} will be emailed a link to set a new password. Their
          current password keeps working until they use it. This is recorded in
          the audit log under your name.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setResetOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleResend} disabled={busy}>
            Send the link
          </Button>
        </div>
      </Modal>

      <Modal open={activeOpen} onClose={() => setActiveOpen(false)}>
        <h3 className="text-lg font-semibold text-gray-900">
          {isActive ? "Deactivate this account?" : "Reactivate this account?"}
        </h3>
        {isActive && blockedDeactivate ? (
          <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            {account.fullName} is the last active Super Staff account.
            Deactivating them would leave no one able to manage internal access.
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            {isActive
              ? "They will lose portal access immediately. This is recorded in the audit log."
              : "They will regain portal access. This is recorded in the audit log."}
          </p>
        )}
        {/* set_staff_account_status rejects a blank reason with 22023: a log
            that records the act but not the justification is the wrong half. */}
        <div className="mt-4 flex flex-col gap-1">
          <label htmlFor="reason" className="text-sm font-medium text-gray-900">
            Reason
          </label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this changing?"
          />
          <p className="text-xs text-gray-500">
            Recorded in the audit log. Required.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setActiveOpen(false)}>
            Cancel
          </Button>
          <Button
            variant={isActive ? "destructive" : "primary"}
            onClick={handleToggleActive}
            disabled={busy || (isActive && blockedDeactivate)}
          >
            {isActive ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </div>
  );
}
