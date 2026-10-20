// src/portals/admin/features/booking/components/venue-utilization-card.tsx
import { VenueBooking } from "@/portals/admin/features/booking/types";

export function VenueUtilizationCard({ venues }: { venues: VenueBooking[] }) {
  const max = Math.max(1, ...venues.map((venue) => venue.bookings));

  return (
    <section className="rounded-none border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">Bookings by venue</h2>
      <p className="text-sm text-gray-500">Utilization across facility options</p>
      <div className="mt-2 divide-y divide-gray-100">
        {venues.map((venue) => (
          <div key={venue.venue} className="py-3 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
                  {venue.venue}
                  {venue.chip && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${venue.chip.chipClass}`}
                    >
                      {venue.chip.label}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">{venue.capacityLabel}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold text-gray-900">
                  {venue.avgFillPct === null ? "—" : `${venue.avgFillPct}%`}
                </p>
                <p className="text-[11px] text-gray-500">
                  {venue.avgFillPct === null ? "no cap tracking" : "avg fill"}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div
                className="h-2 flex-1 bg-gray-100"
                role="img"
                aria-label={`${venue.venue}: ${venue.bookings.toLocaleString()} bookings`}
              >
                <div
                  className={`h-2 ${venue.barClass}`}
                  style={{ width: `${(venue.bookings / max) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-gray-900">
                {venue.bookings}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
