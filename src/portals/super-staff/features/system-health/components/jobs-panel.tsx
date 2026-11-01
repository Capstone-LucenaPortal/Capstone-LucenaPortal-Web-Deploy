import { formatDateTime } from "@/portals/super-staff/lib/utils";
import { formatMs, formatSeconds } from "../lib/format";
import type { SectionJob, SystemHealth } from "../types";
import { Panel, STATUS_WORD, StatusPill, type Tone } from "./panel";

type Sections = SystemHealth["sections"];

/**
 * The last run's outcome in pg_cron's terms: OK or Failed, or pg_cron's own
 * word for anything else ('running', 'starting' …). A fact about the run, not
 * a grade — the pill carries the DB's grade.
 */
function outcome(job: SectionJob): { word: string; failed: boolean } | null {
  if (job.last_status === null) return null;
  if (job.last_status === "succeeded") return { word: "OK", failed: false };
  if (job.last_status === "failed") return { word: "Failed", failed: true };
  return { word: job.last_status[0].toUpperCase() + job.last_status.slice(1), failed: false };
}

/** "Background jobs: Job run history kept past 7 days": the section and the check, by their labels. */
function provedBy(job: SectionJob, sections: Sections): string {
  if (job.proved_by === null) return "—";
  const section = sections[job.proved_by.section];
  const check = section.checks.find((c) => c.key === job.proved_by?.check);
  return `${section.label}: ${check?.label ?? job.proved_by.check}`;
}

function LastRun({ job }: { job: SectionJob }) {
  if (job.last_start === null) return <>Never ran</>;
  const result = outcome(job);
  return (
    <>
      {formatDateTime(job.last_start)}
      {result !== null && (
        <>
          {" · "}
          <span className={result.failed ? "font-medium text-red-700" : undefined}>{result.word}</span>
        </>
      )}
      {job.last_duration_ms !== null && ` · took ${formatMs(job.last_duration_ms)}`}
    </>
  );
}

function JobStatus({ job }: { job: SectionJob }) {
  // Since l92 a switched-off system job grades warning; a job this schema does
  // not schedule still reads ok, and is shown switched off, not healthy.
  const tone: Tone = !job.active && job.status === "ok" ? "muted" : job.status;
  return (
    <div className="flex flex-wrap gap-1.5">
      {job.ran_without_worker && <StatusPill tone={job.status}>No worker</StatusPill>}
      {job.overdue && <StatusPill tone={job.status}>Overdue</StatusPill>}
      <StatusPill tone={tone}>{job.active ? STATUS_WORD[job.status] : "Switched off"}</StatusPill>
    </div>
  );
}

/** Every pg_cron job, with the section its work is for and the check that shows it did that work. */
export function JobsPanel({ sections }: { sections: Sections }) {
  const { items } = sections.jobs.detail;
  return (
    <Panel title="Jobs">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-5 py-2">Job</th>
              <th className="py-2">Serves</th>
              <th className="px-4 py-2">Proved by</th>
              <th className="py-2">Last run</th>
              <th className="px-4 py-2 text-right">Failures (24 h)</th>
              <th className="px-5 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 align-top">
            {items.map((job) => (
              <tr key={job.name}>
                <td className="px-5 py-2 font-mono text-xs font-semibold text-gray-900">{job.name}</td>
                <td className="py-2 text-gray-700">{job.serves === null ? "—" : sections[job.serves].label}</td>
                <td className="px-4 py-2 text-gray-700">{provedBy(job, sections)}</td>
                <td className="py-2 text-gray-700">
                  <LastRun job={job} />
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{job.failures_24h}</td>
                <td className="px-5 py-2">
                  <JobStatus job={job} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

const PURGE_JOB = "purge-cron-history";

/**
 * pg_cron's own run history, which counts against the database limit, and the
 * daily job that keeps it to 7 days: the one repair System Health makes.
 */
export function RunHistoryPanel({ jobs }: { jobs: Sections["jobs"] }) {
  const { run_history_rows, run_history_oldest_seconds, thresholds, items } = jobs.detail;
  const purge = items.find((j) => j.name === PURGE_JOB);
  return (
    <Panel title="Run history">
      <div className="space-y-1 px-5 pb-4 text-sm text-gray-700">
        <p>
          {run_history_rows.toLocaleString("en-PH")} runs kept
          {run_history_oldest_seconds !== null && `, the oldest ${formatSeconds(run_history_oldest_seconds)} old`}
        </p>
        <p>
          <span className="font-mono text-xs">{PURGE_JOB}</span> deletes runs older than{" "}
          {formatSeconds(thresholds.run_history_keep_seconds)}, daily.{" "}
          {purge === undefined
            ? "It is not scheduled."
            : purge.last_start === null
              ? "It has never run."
              : `Last ran ${formatDateTime(purge.last_start)}.`}
        </p>
      </div>
    </Panel>
  );
}
