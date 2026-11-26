"use client";

import { useId, useState, type FormEvent } from "react";
import { useToast } from "@/portals/super-staff/components/providers/toast-provider";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Input } from "@/portals/super-staff/components/ui/input";
import { Select } from "@/portals/super-staff/components/ui/select";
import { Textarea } from "@/portals/super-staff/components/ui/textarea";
import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import { toLogSystemIssueOnBehalfArgs } from "../lib/system-issue-args";
import { systemIssueErrorMessage } from "../lib/system-issue-errors";
import { CATEGORIES, CATEGORY_LABEL, HELPDESK_EMAIL, type IssueCategory } from "../types";

/** The database's limits (l128): an address of at most 254, a description of at most 2000. */
const EMAIL_LIMIT = 254;
const DESCRIPTION_LIMIT = 2000;

/**
 * Super-staff log a System issue for someone who emailed the helpdesk because
 * they could not sign in or sign up (log_system_issue_on_behalf). The email is
 * never matched to an account, so the portal never notifies them: Super-staff
 * reply from the helpdesk.
 */
export function LogOnBehalfForm({
  onLogged,
  onCancel,
}: {
  /** Rereads the queue and opens the new issue. */
  onLogged: (issueId: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const ids = useId();
  const [email, setEmail] = useState("");
  // Most helpdesk emails are about signing in or signing up.
  const [category, setCategory] = useState<IssueCategory>("accounts");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const ready = email.trim() !== "" && description.trim() !== "";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setRefusal(null);
    try {
      const [logged] = await callRpc(
        "log_system_issue_on_behalf",
        toLogSystemIssueOnBehalfArgs({ email, category, description }),
      );
      toast(`${logged.issue_reference} logged.`, "success");
      await onLogged(logged.issue_id);
    } catch (err) {
      const message = systemIssueErrorMessage(err, "Could not log it. Try again.");
      setRefusal(message);
      toast(message, "error");
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Log from helpdesk email"
      className="mb-5 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm"
    >
      <h3 className="font-semibold text-gray-900">Log from helpdesk email</h3>
      <p className="mt-1 text-gray-600">
        For someone who emailed {HELPDESK_EMAIL} because they couldn&apos;t sign in or sign up. They
        get no portal notification: reply to them from the helpdesk.
      </p>
      {/* noValidate: the database's refusal is the one shown, in the panel's words. */}
      <form noValidate onSubmit={(e) => void submit(e)} className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label htmlFor={`${ids}-email`} className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Their email address</span>
            <Input
              id={`${ids}-email`}
              type="email"
              autoComplete="off"
              maxLength={EMAIL_LIMIT}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label htmlFor={`${ids}-category`} className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Part of the website</span>
            <Select
              id={`${ids}-category`}
              value={category}
              onChange={(e) => setCategory(e.target.value as IssueCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <label htmlFor={`${ids}-description`} className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">What they said</span>
          <Textarea
            id={`${ids}-description`}
            rows={3}
            maxLength={DESCRIPTION_LIMIT}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {refusal !== null && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-red-700">
            {refusal}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={busy || !ready}>
            Log System issue
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
