"use client";

import { useEffect, useId, useState } from "react";
import { useToast } from "@/portals/super-staff/components/providers/toast-provider";
import { Button } from "@/portals/super-staff/components/ui/button";
import { HistoryTimeline, type TimelineItem } from "@/portals/super-staff/components/ui/history-timeline";
import { Select } from "@/portals/super-staff/components/ui/select";
import { Textarea } from "@/portals/super-staff/components/ui/textarea";
import { listAuditEntriesForTarget } from "@/portals/super-staff/features/audit-log/lib/queries";
import { toTimelineItems } from "@/portals/super-staff/features/audit-log/lib/timeline";
import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import { formatDate, formatDateTime } from "@/portals/super-staff/lib/utils";
import {
  toCloseSystemIssueArgs,
  toResolveSystemIssueArgs,
  toStartSystemIssueArgs,
  toTriageSystemIssueArgs,
  type TriageChange,
} from "../lib/system-issue-args";
import { systemIssueErrorMessage } from "../lib/system-issue-errors";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CLOSE_REASONS,
  CLOSE_REASON_LABEL,
  HELPDESK_EMAIL,
  PRIORITIES,
  PRIORITY_LABEL,
  isLive,
  reporterLabel,
  type CloseReason,
  type IssueCategory,
  type IssuePriority,
  type SystemIssue,
} from "../types";
import { IssueStatusPill, PriorityPill } from "./issue-pills";
import { IssueScreenshot } from "./issue-screenshot";

type History =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; items: TimelineItem[] };

/**
 * The History, from the audit trail, matched on the issue's id — never its
 * reference. `version` rereads it after each action.
 */
function useIssueHistory(issueId: string, version: number): History {
  const [history, setHistory] = useState<History>({ kind: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    listAuditEntriesForTarget(issueId, controller.signal)
      .then((entries) => setHistory({ kind: "ready", items: toTimelineItems(entries) }))
      .catch(() => {
        if (!controller.signal.aborted) setHistory({ kind: "error" });
      });
    return () => controller.abort();
  }, [issueId, version]);
  return history;
}

/**
 * A reply to an on-behalf reporter, with the reference in the subject. The
 * address goes in the path percent-encoded (RFC 6068), but for its @.
 */
const replyHref = (email: string, reference: string) =>
  `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}?subject=${encodeURIComponent(
    `Your report ${reference} to the Lucena City Portal`,
  )}`;

/** The database's limit on both notes (l128). */
const NOTE_LIMIT = 2000;
const hasText = (note: string) => note.trim() !== "";

/**
 * Everything Super-staff can see and do on one System issue. The queue keys it
 * on the issue's id, so a draft note never carries over to another issue.
 */
export function IssueDetail({
  issue,
  onChanged,
}: {
  issue: SystemIssue;
  /** Rereads the queue. */
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [version, setVersion] = useState(0);
  const history = useIssueHistory(issue.id, version);
  const [busy, setBusy] = useState(false);
  // A refusal stays in the panel after its toast has gone (as #183 did for row
  // saves), until the next action starts.
  const [refusal, setRefusal] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeReason, setCloseReason] = useState<CloseReason | null>(null);
  const [closeNote, setCloseNote] = useState("");
  const ids = useId();
  const live = isLive(issue);

  const stopClosing = () => {
    setClosing(false);
    setCloseReason(null);
    setCloseNote("");
  };

  async function run(call: () => Promise<unknown>, done: string, onDone?: () => void) {
    setBusy(true);
    setRefusal(null);
    try {
      await call();
      toast(done, "success");
      onDone?.();
    } catch (e) {
      const message = systemIssueErrorMessage(e, "Could not save. Try again.");
      setRefusal(message);
      toast(message, "error");
    } finally {
      // Reread after a refusal too: PT409 means the screen is behind the database.
      await onChanged();
      setVersion((v) => v + 1);
      setBusy(false);
    }
  }

  const triage = (change: TriageChange) =>
    run(
      () => callRpc("triage_system_issue", toTriageSystemIssueArgs(issue.id, change)),
      `${issue.reference} updated.`,
    );
  const start = () =>
    run(
      () => callRpc("start_system_issue", toStartSystemIssueArgs(issue.id)),
      `${issue.reference} is in progress.`,
    );
  const resolve = () =>
    run(
      () => callRpc("resolve_system_issue", toResolveSystemIssueArgs(issue.id, resolutionNote)),
      `${issue.reference} resolved.`,
      () => setResolutionNote(""),
    );
  const close = (reason: CloseReason) =>
    run(
      () => callRpc("close_system_issue", toCloseSystemIssueArgs(issue.id, reason, closeNote)),
      `${issue.reference} closed.`,
      stopClosing,
    );

  return (
    <aside
      aria-label={`System issue ${issue.reference}`}
      className="space-y-5 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm xl:w-96 xl:shrink-0"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-gray-500">{issue.reference}</span>
          <IssueStatusPill status={issue.status} />
          <PriorityPill priority={issue.priority} />
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-base text-gray-900">
          {issue.description}
        </p>
        {issue.resolutionNote !== null && (
          <p className="mt-2 rounded-md bg-green-50 p-2 text-green-900">
            <strong>Resolution:</strong> {issue.resolutionNote}
            {issue.closesAt !== null && (
              <span className="mt-1 block text-xs text-green-800">
                {issue.status === "closed"
                  ? `Closed by itself on ${formatDate(issue.closesAt)}.`
                  : `Closes by itself on ${formatDate(issue.closesAt)}.`}
              </span>
            )}
          </p>
        )}
        {issue.closeReason !== null && (
          <p className="mt-2 rounded-md bg-gray-100 p-2 text-gray-800">
            <strong>Closed — {CLOSE_REASON_LABEL[issue.closeReason]}:</strong> {issue.closeNote}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-md border border-gray-200 bg-gray-50 p-3 text-gray-700">
        <dt className="text-gray-500">Reported by</dt>
        <dd>{reporterLabel(issue)}</dd>
        <dt className="text-gray-500">Reported</dt>
        <dd>{formatDateTime(issue.createdAt)}</dd>
        <dt className="text-gray-500">Page</dt>
        <dd className="break-all font-mono text-xs leading-5">{issue.capturedPage ?? "Not captured"}</dd>
        <dt className="text-gray-500">Browser</dt>
        <dd className="break-words">{issue.userAgent ?? "Not captured"}</dd>
        <dt className="text-gray-500">Screenshot</dt>
        <dd>
          <IssueScreenshot path={issue.screenshotPath} />
        </dd>
      </dl>

      {issue.isOnBehalf && (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <p>
            Logged from a helpdesk email. They have no portal account to notify, so nothing here
            reaches them: reply from {HELPDESK_EMAIL}.
          </p>
          {issue.reporterEmail !== null && (
            <a
              href={replyHref(issue.reporterEmail, issue.reference)}
              className="inline-block font-semibold text-lucena-blue hover:underline"
            >
              Reply by email
            </a>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">Category</span>
          <Select
            value={issue.category}
            disabled={!live || busy}
            onChange={(e) => void triage({ category: e.target.value as IssueCategory })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">Priority</span>
          <Select
            value={issue.priority ?? ""}
            disabled={!live || busy}
            onChange={(e) => void triage({ priority: e.target.value as IssuePriority })}
          >
            {/* The database never clears a priority (l128 §4f): a starting
                value only, never a choice. */}
            {issue.priority === null && (
              <option value="" disabled>
                Not prioritised
              </option>
            )}
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {refusal !== null && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-red-700">
          {refusal}
        </p>
      )}

      {live && (
        <div className="space-y-3 rounded-md border border-gray-200 p-3">
          {issue.status === "open" && (
            <Button variant="primary" disabled={busy} onClick={() => void start()}>
              Start working on it
            </Button>
          )}
          {issue.status === "in_progress" && (
            <div className="space-y-2">
              <label htmlFor={`${ids}-resolution`} className="block text-xs font-semibold text-gray-600">
                Resolution note{" "}
                {!issue.isOnBehalf && (
                  <span className="font-normal text-gray-500">(the reporter sees this)</span>
                )}
              </label>
              <Textarea
                id={`${ids}-resolution`}
                rows={3}
                maxLength={NOTE_LIMIT}
                placeholder="What was fixed?"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
              />
              <Button
                variant="primary"
                disabled={busy || !hasText(resolutionNote)}
                onClick={() => void resolve()}
              >
                Mark resolved
              </Button>
            </div>
          )}

          <div className="border-t border-gray-100 pt-3">
            {!closing ? (
              <p className="text-xs text-gray-500">
                Not a fault with the website?{" "}
                <button
                  type="button"
                  className="font-semibold text-gray-700 underline"
                  onClick={() => setClosing(true)}
                >
                  Close with a reason
                </button>
              </p>
            ) : (
              <div className="space-y-2">
                <fieldset>
                  <legend className="mb-1 text-xs font-semibold text-gray-600">Reason</legend>
                  <div className="flex flex-wrap gap-4">
                    {CLOSE_REASONS.map((r) => (
                      <label key={r} className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={`${ids}-reason`}
                          value={r}
                          checked={closeReason === r}
                          onChange={() => setCloseReason(r)}
                        />
                        {CLOSE_REASON_LABEL[r]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label htmlFor={`${ids}-close`} className="block text-xs font-semibold text-gray-600">
                  Close note
                </label>
                <Textarea
                  id={`${ids}-close`}
                  rows={2}
                  maxLength={NOTE_LIMIT}
                  placeholder={
                    closeReason === "duplicate"
                      ? "Which report is it a duplicate of?"
                      : "Where should they go instead?"
                  }
                  value={closeNote}
                  onChange={(e) => setCloseNote(e.target.value)}
                />
                {!issue.isOnBehalf && (
                  <p className="text-xs text-gray-500">The reporter sees the reason and this note.</p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    disabled={busy || closeReason === null || !hasText(closeNote)}
                    onClick={() => {
                      if (closeReason !== null) void close(closeReason);
                    }}
                  >
                    Close System issue
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={stopClosing}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <section aria-label="History">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">History</h3>
        {history.kind === "loading" ? (
          <p className="text-sm text-gray-500">Loading&hellip;</p>
        ) : history.kind === "error" ? (
          <p className="text-sm text-red-500">Could not load the history.</p>
        ) : (
          <HistoryTimeline items={history.items} />
        )}
      </section>
    </aside>
  );
}
