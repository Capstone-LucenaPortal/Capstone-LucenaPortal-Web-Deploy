"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/portals/super-staff/components/ui/card";
import { Modal } from "@/portals/super-staff/components/ui/modal";
import { useToast } from "@/portals/super-staff/components/providers/toast-provider";
import { inviteAccount } from "../lib/invite";
import { toInvitePayload } from "../lib/invite-payload";
import { listAccounts } from "../lib/queries";
import { validateAccount, type FieldErrors } from "../lib/validation";
import { AccountFormFields, type AccountFormValue } from "./account-form-fields";
import { AccountStepper } from "./account-stepper";

const EMPTY: AccountFormValue = {
  fullName: "",
  email: "",
  role: "Staff",
  modules: [],
  isSupervisor: false,
};

const ELEVATED_COPY: Record<string, string> = {
  Admin: "Admin accounts can manage citizen-facing records across every module.",
  "Super Staff":
    "Super Staff accounts can manage internal accounts, system configuration, and announcements.",
};

export function CreateAccountForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState<AccountFormValue>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [emails, setEmails] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Real addresses. Until now this compared against fixtures, so a genuine
  // duplicate was never caught here and only failed at inviteUserByEmail.
  useEffect(() => {
    listAccounts().then((rows) => setEmails(rows.map((a) => a.email)));
  }, []);

  const isElevated = value.role === "Admin" || value.role === "Super Staff";

  async function commit() {
    setSubmitting(true);
    try {
      // No actor argument: create_staff_account_profile takes auth.uid() from
      // the caller's JWT and writes the audit row itself, so the Super Staff
      // is named by the database rather than by this form.
      const result = await inviteAccount(toInvitePayload(value));
      toast(`Invite sent to ${result.invited_email}.`, "success");
      router.push(`/super-staff/accounts/${result.account.id}`);
    } catch (error) {
      // The Edge Function's own message — "A responder needs a department…",
      // "Only a Super Staff can create accounts.", an SMTP failure — is far
      // more useful than a generic retry prompt.
      toast(
        error instanceof Error
          ? error.message
          : "Could not create the account. Try again.",
        "error",
      );
      setSubmitting(false);
    }
  }

  function handleCreate() {
    const found = validateAccount(value, emails);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast("Fix the highlighted fields.", "error");
      return;
    }
    if (isElevated) {
      setConfirmOpen(true);
      return;
    }
    void commit();
  }

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold text-lucena-blue">New account</h1>
        <p className="text-gray-500 mt-2">
          Create an internal portal account and send credentials.
        </p>
      </div>

      <AccountStepper />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <AccountFormFields
                value={value}
                errors={errors}
                onChange={setValue}
              />
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => router.push("/super-staff/accounts")}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreate}
                  disabled={submitting}
                >
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside>
          <Card>
            <CardHeader>
              <CardTitle>What happens next</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• An invite link is emailed to the address entered.</li>
                <li>
                  • They set their own password; nobody else ever knows it.
                </li>
                <li>
                  • This action is recorded in the audit log under your name.
                </li>
                <li>
                  • Elevated roles (Admin, Super Staff) require an extra
                  confirmation.
                </li>
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <h3 className="text-lg font-semibold text-gray-900">
          Create an elevated {value.role} account?
        </h3>
        <p className="mt-2 text-sm text-gray-600">{ELEVATED_COPY[value.role]}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={submitting}
            onClick={() => {
              setConfirmOpen(false);
              void commit();
            }}
          >
            Create {value.role} account
          </Button>
        </div>
      </Modal>
    </div>
  );
}
