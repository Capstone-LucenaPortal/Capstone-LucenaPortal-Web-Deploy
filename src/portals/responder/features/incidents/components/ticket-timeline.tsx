import type { TimelineEntry } from "@/portals/responder/features/incidents/lib/work";

/**
 * The thing PRD §4.3 says staff watch read-only. Chronological, oldest first:
 * the whole screen above it is a forward narrative — "Progress · tap as you
 * go" — and the connector line reads as the job proceeding, not as a feed.
 *
 * Presentation only. Every string here was computed by `buildTimeline`, so a
 * removed photo cannot leave an entry behind.
 */
export function TicketTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <section className="bg-white px-4 py-3.75">
      <h2 className="mb-3 text-[11px] font-bold tracking-[0.07em] uppercase text-gray-500">
        Timeline · staff sees this live
      </h2>

      <ol className="flex flex-col gap-3.5">
        {entries.map((entry, index) => (
          <li key={`${entry.at}-${index}`} className="flex gap-2.75">
            <div className="flex flex-col items-center pt-1.25" aria-hidden>
              <span className="h-2 w-2 shrink-0 rounded-full bg-lucena-blue" />
              {index < entries.length - 1 && (
                <span className="mt-1 w-px flex-1 bg-gray-200" />
              )}
            </div>
            <div className="pb-0.5">
              <p className="text-[13.5px] font-semibold text-pretty text-gray-900">
                {entry.title}
              </p>
              <p className="text-[11.5px] text-gray-500">{entry.meta}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
