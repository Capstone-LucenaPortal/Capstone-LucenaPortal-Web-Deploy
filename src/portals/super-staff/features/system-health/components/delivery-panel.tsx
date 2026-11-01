import { formatSeconds } from "../lib/format";
import type { ChannelDelivery, FailureReason, PlatformSections } from "../types";
import { Panel } from "./panel";

type NotificationsDetail = PlatformSections["notifications"]["detail"];

const CHANNEL_LABEL: Record<ChannelDelivery["channel"], string> = {
  email: "Email",
  push: "Push",
  in_app: "In-app",
};

const COUNTS = [
  ["queued", "Queued"],
  ["sent", "Sent"],
  ["failed", "Failed"],
  ["bounced", "Bounced"],
  ["retrying", "Retrying"],
  ["withheld", "Withheld"],
  ["mocked", "Mocked"],
] as const;

/** The database's fixed categories, in its order. Never the raw error text. */
const REASONS: Array<[FailureReason, string]> = [
  ["no_destination", "No destination"],
  ["worker_lost", "Worker lost"],
  ["provider_unavailable", "Provider unavailable"],
  ["provider_refused", "Provider refused"],
  ["bounce", "Bounced"],
  ["other", "Other"],
];

const HEAD = "border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500";

/**
 * Counts only: never any per-recipient data. Every count is rows created in
 * the last 24 h; the oldest queued age is any age. The checks table grades
 * them.
 */
export function DeliveryPanel({ detail }: { detail: NotificationsDetail }) {
  return (
    <Panel title="Delivery by channel (24 h)">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={HEAD}>
              <th className="px-5 py-2">Channel</th>
              {COUNTS.map(([key, label]) => (
                <th key={key} className="px-2 py-2 text-right">
                  {label}
                </th>
              ))}
              <th className="px-5 py-2 text-right">Oldest queued</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {detail.channels.map((c) => (
              <tr key={c.channel}>
                <td className="px-5 py-2 font-medium text-gray-900">{CHANNEL_LABEL[c.channel]}</td>
                {COUNTS.map(([key]) => (
                  <td key={key} className="px-2 py-2 text-right tabular-nums">
                    {c[key].toLocaleString("en-PH")}
                  </td>
                ))}
                <td className="whitespace-nowrap px-5 py-2 text-right tabular-nums">
                  {formatSeconds(c.oldest_queued_seconds)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-1 border-t border-gray-200 px-5 py-3 text-xs text-gray-500">
        {detail.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </Panel>
  );
}

/** Failures grouped by the database's reason category, per channel; only the reasons that occurred. */
export function FailureReasonsPanel({ detail }: { detail: NotificationsDetail }) {
  const reasons = REASONS.filter(([key]) => detail.channels.some((c) => c.failure_reasons[key] > 0));
  return (
    <Panel title="Failures by reason (24 h)">
      {reasons.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-gray-500">No failures in the last 24 h.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className={HEAD}>
              <th className="px-5 py-2">Reason</th>
              {detail.channels.map((c) => (
                <th key={c.channel} className="px-5 py-2 text-right">
                  {CHANNEL_LABEL[c.channel]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reasons.map(([key, label]) => (
              <tr key={key}>
                <td className="px-5 py-2 text-gray-900">{label}</td>
                {detail.channels.map((c) => (
                  <td key={c.channel} className="px-5 py-2 text-right tabular-nums">
                    {c.failure_reasons[key].toLocaleString("en-PH")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
