"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/portals/super-staff/components/ui/button";
import { cn, formatDateTime } from "@/portals/super-staff/lib/utils";
import { systemIssueErrorMessage } from "../lib/system-issue-errors";
import { listSystemIssues } from "../lib/system-issue-queries";
import { TABS, inTab, queue, type QueueTab } from "../lib/queue";
import { CATEGORY_LABEL, isLive, reporterLabel, type SystemIssue } from "../types";
import { IssueDetail } from "./issue-detail";
import { IssueStatusPill, PriorityPill } from "./issue-pills";
import { LogOnBehalfForm } from "./log-on-behalf-form";

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; issues: SystemIssue[] };

/**
 * Super-staff's System issues (ADR 0013): the user-reported side of IT
 * incident management, where System Health is the monitoring side. A queue
 * with status tabs and a detail panel on the right, the prototype's variant A.
 */
export function SystemIssuesView() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [tab, setTab] = useState<QueueTab>("attention");
  // Null follows the tab's first row. A picked issue stays in the panel even
  // once an action moves it out of the tab, so the officer sees what happened.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);

  const reload = useCallback(
    (): Promise<void> =>
      listSystemIssues()
        .then((issues) => setLoad({ kind: "ready", issues }))
        .catch((e: unknown) =>
          setLoad({ kind: "error", message: systemIssueErrorMessage(e, "Could not load System issues.") }),
        ),
    [],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const issues = load.kind === "ready" ? load.issues : [];
  const shown = queue(issues, tab);
  const selected = issues.find((i) => i.id === selectedId) ?? shown[0] ?? null;
  const live = issues.filter(isLive);

  return (
    <div className="pb-24">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">System issues</h2>
          <p className="mt-1 text-sm text-gray-500">
            Problems with the portal that people report: the user side of IT incidents, where System
            Health&apos;s sections are the monitoring side.
            {load.kind === "ready" && (
              <>
                {" "}
                {live.length} open, {live.filter((i) => i.priority === null).length} not yet
                prioritised.
              </>
            )}
          </p>
        </div>
        {load.kind === "ready" && !logging && (
          <Button variant="secondary" onClick={() => setLogging(true)}>
            Log from helpdesk email
          </Button>
        )}
      </div>

      {load.kind === "ready" && logging && (
        <LogOnBehalfForm
          onCancel={() => setLogging(false)}
          onLogged={async (id) => {
            // A new issue is Open: show it on Needs attention, in the panel.
            setTab("attention");
            setSelectedId(id);
            await reload();
            setLogging(false);
          }}
        />
      )}

      {load.kind === "loading" ? (
        <p className="text-sm text-gray-500">Loading&hellip;</p>
      ) : load.kind === "error" ? (
        <p className="text-sm text-red-500">{load.message}</p>
      ) : (
        <>
          <div role="tablist" aria-label="Status" className="mb-3 flex gap-1 border-b border-gray-200">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => {
                  setTab(t.key);
                  setSelectedId(null);
                }}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm",
                  tab === t.key
                    ? "border-lucena-blue font-semibold text-lucena-blue"
                    : "border-transparent text-gray-500 hover:text-gray-700",
                )}
              >
                {t.label}{" "}
                <span className="text-xs font-normal text-gray-400">
                  ({issues.filter((i) => inTab(i, t.key)).length})
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
            <div className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Reference</th>
                    <th className="px-3 py-2 font-medium">Area</th>
                    <th className="px-3 py-2 font-medium">Problem</th>
                    <th className="px-3 py-2 font-medium">Priority</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Reported</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((i) => {
                    const picked = selected?.id === i.id;
                    return (
                      <tr
                        key={i.id}
                        onClick={() => setSelectedId(i.id)}
                        className={cn(
                          "cursor-pointer border-t border-gray-100 hover:bg-blue-50/50",
                          picked && "bg-blue-50",
                        )}
                      >
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            aria-pressed={picked}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(i.id);
                            }}
                            className="whitespace-nowrap font-mono text-xs text-lucena-blue hover:underline"
                          >
                            {i.reference}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">{CATEGORY_LABEL[i.category]}</td>
                        <td className="max-w-xs truncate px-3 py-2 text-gray-700" title={i.description}>
                          {i.description}
                        </td>
                        <td className="px-3 py-2">
                          <PriorityPill priority={i.priority} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <IssueStatusPill status={i.status} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">
                          {formatDateTime(i.createdAt)}
                          <br />
                          {reporterLabel(i)}
                        </td>
                      </tr>
                    );
                  })}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                        No System issues here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selected && (
              <IssueDetail
                key={selected.id}
                issue={selected}
                onChanged={() => {
                  // Pin the panel before the reread: an unpicked first row the
                  // action moved off the tab must not hand the panel, and its
                  // refusal, to the next row.
                  setSelectedId(selected.id);
                  return reload();
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
