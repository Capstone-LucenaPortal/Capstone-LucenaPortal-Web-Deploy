import { formatDate } from "@/portals/super-staff/lib/utils";

export type TimelineItem = {
  id: string;
  timestamp: string;
  summary: string;
  actor: string;
};

export function HistoryTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No history yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3">
          <div className="mt-1 flex flex-col items-center">
            <span className="h-2 w-2 shrink-0 rounded-full bg-lucena-blue" />
            <span className="mt-1 w-px flex-1 bg-gray-200" />
          </div>
          <div className="space-y-0.5 pb-1">
            <p className="text-sm text-gray-900">{item.summary}</p>
            <p className="text-xs text-gray-500">
              {formatDate(item.timestamp)} · {item.actor}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
