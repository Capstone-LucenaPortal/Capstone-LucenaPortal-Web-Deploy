// src/portals/admin/features/booking/components/convention-center-page.tsx
"use client";


import { Suspense, useEffect, useMemo, useState } from "react";
import {
  bookingPastDueRows,
  conventionDateAccessor,
  conventionRangeStats,
  eventTypeMix,
  formatRate,
  recentMonthlyCounts,
  bookingRequestsPerVenue,
} from "@/portals/admin/lib/aggregate";
import { bookingMet, bookingsDecidedOnTime, formatTargetGap } from "@/portals/admin/features/sla/lib/sla";
import { CONVENTION_CENTER_PATH } from "@/portals/admin/features/sla/lib/sla-links";
import {
  NO_SLA_ROW_FILTER,
  useSlaRowFilter,
  type SlaRowFilterState,
} from "@/portals/admin/features/sla/hooks/use-sla-row-filter";
import { SlaRowFilterBanner } from "@/portals/admin/features/sla/components/sla-row-filter-banner";
import { ConventionDateBasis } from "@/portals/admin/features/booking/types";
import {
  filterByDateRange,
  formatManilaDate,
  formatManilaRangeLabel,
  formatManilaTimestamp,
  presetDateRange,
} from "@/portals/admin/lib/dates";
import { listBookings, BookingRow } from "@/portals/admin/features/booking/lib/bookings";
import {
  listVenues,
  VenueRow,
  listBookingEventTypes,
  BookingEventTypeRow,
} from "@/portals/admin/lib/supabase/catalogs";
import type { PortalError } from "@/portals/admin/lib/supabase/errors";
import { Tabs } from "@/portals/admin/components/ui/tabs";
import { DataTable } from "@/portals/admin/components/ui/data-table";
import { Badge, BadgeVariant } from "@/portals/admin/components/ui/badge";
import { Button } from "@/portals/admin/components/ui/button";
import { DateFilterBar, DateFilterPreset } from "@/portals/admin/components/ui/date-filter-bar";
import { KpiTile } from "@/portals/admin/components/ui/kpi-tile";
import { PageHero } from "@/portals/admin/components/layout/page-hero";
import { MixBarCard } from "@/portals/admin/components/ui/mix-bar-card";
import { MonthlyBarCard } from "@/portals/admin/components/ui/monthly-bar-card";
import { LoadingStatus, Skeleton } from "@/portals/admin/components/ui/skeleton";
import { VenueRequestsCard } from "@/portals/admin/features/booking/components/venue-requests-card";
import { BookingReviewModal } from "@/portals/admin/features/booking/components/booking-review-modal";
import { getBookingStatusVariant, getEventTypeBarClass, getEventTypeChipClasses } from "@/portals/admin/lib/status-colors";
import {
  BOOKING_CANCELLATION_REASON_LABELS,
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_ORDER,
  BookingStatusValue,
} from "@/portals/admin/lib/status-labels";
import { downloadCsv } from "@/portals/admin/lib/csv";

// Decision Date reads when the booking's clock stopped: SLA Reports'
// Resolution Date for a booking, so a Finished late link opened under it keeps
// its date type here (#175).
const BASIS_OPTIONS: { value: ConventionDateBasis; label: string }[] = [
  { value: "booking", label: "Booking Date" },
  { value: "event", label: "Event Date" },
  { value: "decision", label: "Decision Date" },
];
const BASIS_VALUES = BASIS_OPTIONS.map((option) => option.value);

// The monthly chart's subtitle names the date the picked date type reads. The
// default (submitted) date type keeps the subtitle as it always was. The
// table's "Event date" column stays under every date type.
const MONTHLY_SUBTITLE: Record<ConventionDateBasis, string> = {
  booking: "Last 6 months",
  event: "By event date · Last 6 months",
  decision: "By decision date · Last 6 months",
};

// The real booking_status enum, in display order, each with its human label
// (src/portals/admin/lib/status-labels.ts — bookings have no Staff sibling to port from, so
// this label text is unchanged by this task). "All" is a UI-only
// pseudo-status, not a database value.
const STATUS_TABS: { value: "all" | BookingStatusValue; label: string }[] = [
  { value: "all", label: "All" },
  ...BOOKING_STATUS_ORDER.map((value) => ({ value, label: BOOKING_STATUS_LABELS[value] })),
];

function statusLabel(status: BookingRow["status"]): string {
  if (!status) return "Unknown";
  return BOOKING_STATUS_LABELS[status] ?? status;
}

function statusVariant(status: BookingRow["status"]): BadgeVariant {
  return status ? getBookingStatusVariant(status) : "default";
}

// "—" for null rather than a blank cell — an active (non-cancelled) booking
// has no cancellation_reason, which is a legitimately-absent value, not
// missing data (same convention as venueLabel elsewhere on this page, and
// closureReasonLabel on the Issue Reports page).
function cancellationReasonLabel(reason: BookingRow["cancellation_reason"]): string {
  if (!reason) return "—";
  return BOOKING_CANCELLATION_REASON_LABELS[reason] ?? reason;
}

function filterRows(rows: BookingRow[], tab: (typeof STATUS_TABS)[number]["value"]): BookingRow[] {
  if (tab === "all") return rows;
  return rows.filter((row) => row.status === tab);
}

export function ConventionCenterPage() {
  // Only the part that reads the address waits for it, as on the Yellow Card
  // page (#133): a prerender sends the page unfiltered, and the browser then
  // renders it from the address.
  return (
    <Suspense fallback={<ConventionCenterView sla={NO_SLA_ROW_FILTER} />}>
      <ConventionCenterAtAddress />
    </Suspense>
  );
}

function ConventionCenterAtAddress() {
  // Arriving from SLA Reports' Booking Finished late or Past due now (#175):
  // the link seeds the range and date type, and narrows the Recent bookings
  // table. The body starts afresh on each address it lands on (#131).
  const sla = useSlaRowFilter(CONVENTION_CENTER_PATH, BASIS_VALUES);
  return <ConventionCenterView key={sla.arrival} sla={sla} />;
}

function ConventionCenterView({ sla }: { sla: SlaRowFilterState<ConventionDateBasis> }) {
  const { link, filter: slaFilter, clear: clearSlaFilter } = sla;
  const [preset, setPreset] = useState<DateFilterPreset>(link?.preset ?? "Month");
  // Seeded from the current Manila month rather than from literals written
  // the day this page was authored — see the yellow-card page for the same
  // note. Lazy initialisers, so presetDateRange runs once on mount.
  const [customStart, setCustomStart] = useState(() => link?.from ?? presetDateRange("Month").from);
  const [customEnd, setCustomEnd] = useState(() => link?.to ?? presetDateRange("Month").to);
  const [dateBasis, setDateBasis] = useState<ConventionDateBasis>(link?.basis ?? "booking");
  const [compare, setCompare] = useState(true);
  const [activeTab, setActiveTab] = useState<(typeof STATUS_TABS)[number]["value"]>("all");
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const [rows, setRows] = useState<BookingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<PortalError | null>(null);
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [eventTypes, setEventTypes] = useState<BookingEventTypeRow[]>([]);
  // Set only inside the fetch effect's success path below, never on every
  // render — this is what lets the "Updated {time} (Asia/Manila)" stamp near
  // the title show only after data has actually loaded at least once, not
  // during the initial load or after a failed fetch (Admin Portal Fix Plan,
  // Task 4.3).
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  // Bumped only by handleRetry below so the fetch effect's dependency array
  // can name it without the effect itself ever writing to it — clicking
  // Retry re-runs this exact effect rather than duplicating the fetch logic
  // into a second function. Nothing else in this component changes it, so
  // this cannot turn into a second fetch on an ordinary render.
  const [retryCount, setRetryCount] = useState(0);

  // A fresh AbortController per effect run (mount, or a Retry click bumping
  // `retryCount`) whose signal is threaded into listBookings() — the same
  // pattern Dashboard/SLA Reports use (Admin Portal Fix Plan Task 4.2).
  // Before this fix this effect used only the `active` boolean-flag pattern:
  // correctness-safe (a stale response was still discarded), but not
  // load-safe — a Retry click or navigating away mid-fetch left
  // fetchAllRows' pagination loop running to completion with nothing to
  // actually cancel the in-flight HTTP requests, undercutting the point of
  // this phase (Phase 4 final review, finding 2). listBookings already
  // accepted an optional `signal` before this fix; this page just never
  // passed one.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting loading/error state at the start of a data fetch is the standard fetch-in-effect shape; there is no external system to synchronize with instead.
    setIsLoading(true);
    setError(null);

    listBookings(controller.signal)
      .then((data) => {
        if (!active) return;
        setRows(data);
        // Only stamped on an actual successful resolution — not in .finally,
        // which also runs on failure — so the "Updated" stamp near the
        // title never appears for a load that failed or was cancelled.
        setLastUpdatedAt(new Date());
      })
      .catch((err: PortalError) => {
        if (!active) return;
        setError(err);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    // Venue labels are a display nicety, not a load gate: public_booking_venues
    // is public reference data with its own failure mode, and a caller who
    // cannot fetch it should still see the booking list with raw venue_code
    // values rather than an error blocking the page.
    listVenues()
      .then((data) => {
        if (!active) return;
        setVenues(data);
      })
      .catch(() => {
        // Swallowed on purpose — see comment above.
      });

    // Same "display nicety, not a load gate" reasoning as listVenues above:
    // public_booking_event_types is public reference data, and a caller who
    // can't fetch it should still see the event type mix panel with raw
    // event_type_code values rather than an error blocking the page.
    listBookingEventTypes()
      .then((data) => {
        if (!active) return;
        setEventTypes(data);
      })
      .catch(() => {
        // Swallowed on purpose — see comment above.
      });

    return () => {
      active = false;
      controller.abort();
    };
    // `retryCount` is the only thing that can re-run this effect after
    // mount: clicking Retry below bumps it, which re-executes this exact
    // fetch. No other state this component holds is in this array, so a
    // filter change recomputes via the useMemo derivations below with zero
    // additional requests.
  }, [retryCount]);

  // Re-runs the fetch effect above on demand by bumping its `retryCount`
  // dependency, rather than duplicating the fetch logic into a second
  // function.
  function handleRetry() {
    setRetryCount((count) => count + 1);
  }

  const venueLabel = useMemo(() => {
    const byCode = new Map(venues.map((venue) => [venue.code, venue.label]));
    return (code: string | null): string => {
      if (!code) return "—";
      return byCode.get(code) ?? code;
    };
  }, [venues]);

  // Fix round 1, item 3: eventTypeMix returns the raw event_type_code
  // (there's no label on admin_booking_analytics itself); this joins it to
  // the human label from the catalog, falling back to the raw code — same
  // fallback shape as venueLabel above — rather than rendering blank when
  // the catalog has no match (or hasn't loaded yet).
  const eventTypeLabel = useMemo(() => {
    const byCode = new Map(eventTypes.map((type) => [type.code, type.label]));
    return (code: string): string => byCode.get(code) ?? code;
  }, [eventTypes]);

  // The table, KPI tiles and CSV export must all describe the same date
  // range: every DateFilterPreset value (including "Custom") resolves to
  // concrete from/to bounds, so the table is never silently unfiltered.
  const dateRange = useMemo(
    () => (preset === "Custom" ? { from: customStart, to: customEnd } : presetDateRange(preset)),
    [preset, customStart, customEnd]
  );
  // "booking" reads submitted_at; "event" reads event_date — a booking
  // record with no event_date drops out of the KPI tiles, the table, the CSV
  // Export, every panel and the monthly chart under that basis. One accessor
  // feeds all of them so they always count the same rows (issue #24).
  const getDate = conventionDateAccessor(dateBasis);
  const rangeLabel = useMemo(() => formatManilaRangeLabel(dateRange), [dateRange]);
  const stats = useMemo(
    () => conventionRangeStats(rows, dateRange, getDate),
    [rows, dateRange, getDate]
  );
  // Scored by the rules every page shares (slaCompliance), on the page's
  // date type, so on the booking date it is SLA Reports' Booking Compliance
  // for the same range (metrics sheet C9, #175).
  const decidedOnTime = useMemo(() => bookingsDecidedOnTime(rows, dateRange, getDate), [rows, dateRange, getDate]);
  const filtered = useMemo(
    () => filterByDateRange(filterRows(rows, activeTab), getDate, dateRange),
    [rows, activeTab, getDate, dateRange]
  );
  // The table alone narrows to SLA Reports' filter; the tiles and panels
  // still describe the range. Finished late is the bookings in range scored
  // late by the rule SLA Reports counts with (bookingMet). Past due now is
  // the bookings on the city's clock past due, whatever the range.
  const tableRows = useMemo(() => {
    if (slaFilter === "past-due") return filterRows(bookingPastDueRows(rows), activeTab);
    if (slaFilter === "late") return filtered.filter((row) => bookingMet(row) === false);
    return filtered;
  }, [slaFilter, rows, activeTab, filtered]);

  // eventTypeMix reads `filtered`, not raw `rows`, so this panel agrees with
  // the status tab and date preset the table/CSV export below already
  // reflect (Fix round 1, item 2) — a mix panel that silently ignored the
  // active filter would be worse than a stale KPI number, since a stale
  // chart doesn't visually look wrong the way a stale number does.
  const eventTypeMixSlices = useMemo(() => eventTypeMix(filtered), [filtered]);
  // Unlike eventTypeMix above, recentMonthlyCounts stays on the raw, unfiltered
  // `rows` — not `filtered` — on purpose: it exists to show a multi-month
  // trend, and feeding it an already date-preset-narrowed array would
  // collapse most presets to a single bucket, defeating the chart. Do not
  // "fix" this to match the panel above.
  //
  // MonthlyBarCard's title promises "Last 6 months"; recentMonthlyCounts
  // keeps the trailing 6 Manila months present, counted by the picked date
  // type. It never shows a month after the current one, so upcoming event
  // dates can't push the past months out of the window.
  const monthlyBookings = useMemo(() => recentMonthlyCounts(rows, getDate), [rows, getDate]);
  // The venue panel reads `filtered`, like the event type mix: the range and
  // the status tab both narrow it (#118, metrics sheet C7). It used to read
  // raw `rows`, so a narrow range still showed every year's requests. Every
  // venue in the catalog still gets a row, with 0 when nobody booked it.
  const venueRequests = useMemo(() => bookingRequestsPerVenue(filtered, venues), [filtered, venues]);

  // `rows` start empty and only hold real data once a load succeeds, so an
  // export before then is a header-only CSV that looks like a real report
  // (#146, the #141 rule). The button is disabled on this, and
  // handleExportBookings checks it again as a backstop. An empty range after
  // a good load is still exportable.
  const canExport = !isLoading && !error;

  // The CSV carries no organiser PII — every column here also appears in the
  // visible table — so it reads the table's own rows directly rather than
  // going through the audited readBookingPii RPC (contrast with Yellow Card's
  // exportApplications, which releases applicant identity and must be
  // audited). Being built from the table, it narrows with SLA Reports'
  // filter too, so unlike the Yellow Card's it stays on while one is set
  // (#175).
  function handleExportBookings() {
    if (!canExport) return;
    downloadCsv(
      "convention-center-bookings.csv",
      ["Reference", "Event", "Venue", "Event date", "Status", "Cancellation Reason"],
      tableRows.map((row) => [
        row.reference_number ?? "—",
        row.event_title ?? "—",
        venueLabel(row.venue_code),
        formatManilaDate(row.event_date),
        statusLabel(row.status),
        cancellationReasonLabel(row.cancellation_reason),
      ])
    );
  }

  return (
    <div className="space-y-4">
      <PageHero title="Convention Center Bookings" subtitle="Demand, event days and venue mix" image="/perez-park.webp">
        <DateFilterBar
          tone="dark"
          basisOptions={BASIS_OPTIONS}
          dateBasis={dateBasis}
          onDateBasisChange={setDateBasis}
          preset={preset}
          onPresetChange={setPreset}
          customStart={customStart}
          customEnd={customEnd}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
          compare={compare}
          onCompareChange={setCompare}
        />
      </PageHero>

      {/* Only rendered once `lastUpdatedAt` has actually been set by a
          successful fetch — never during the initial load, and never after
          a failed one, so this never claims freshness the page does not
          have. */}
      {lastUpdatedAt && (
        <p className="text-xs text-gray-500">Updated {formatManilaTimestamp(lastUpdatedAt)} (Asia/Manila)</p>
      )}
      {/* The KPI tiles and the Recent bookings table below both render
          Skeleton placeholders while `isLoading` — Skeleton is aria-hidden (a
          purely visual block), so without this a screen reader gets no
          signal any of that is loading, unlike the plain "Loading bookings…"
          DOM text it replaced. One page-level announcement is enough: both
          regions are driven by this same single `isLoading`, so they start
          and finish loading together. */}
      {isLoading && <LoadingStatus label="Loading bookings…" />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Booking requests: demand, whatever became of each request. The
            caption says how many were confirmed, fully paid or completed,
            which answers "how many events took place?" (#118, metrics
            sheet C1). Volume figure: grey delta. */}
        <KpiTile
          label="Booking requests"
          value={isLoading ? <Skeleton className="h-7 w-16" /> : error ? "—" : stats.bookings.toLocaleString()}
          caption={isLoading || error ? undefined : `${stats.confirmed.toLocaleString()} confirmed`}
          note={isLoading ? <Skeleton className="h-3 w-24" /> : error || !compare ? undefined : stats.bookingsDelta}
          direction="neutral"
          noteTone="positive"
        />
        {/* Event days, not Utilization: no venue capacity NUMBER exists to
            divide by, so this counts days in range with a confirmed booking,
            by event date whatever the date type and status tab. The same
            figure as the Dashboard's "Days with an event" (eventDays in
            src/portals/admin/lib/aggregate.ts, #117). Not judged against a
            promise, so it has no better-or-worse delta. */}
        <KpiTile
          label="Event days"
          value={isLoading ? <Skeleton className="h-7 w-16" /> : error ? "—" : `${stats.eventDays.pct}%`}
          caption={isLoading || error ? undefined : stats.eventDays.note}
          note={isLoading ? <Skeleton className="h-3 w-24" /> : undefined}
          noteTone="neutral"
        />
        {/* Whether the office answers organisers on time (#175, metrics
            sheet C9): bookings confirmed or refused within their target, 3
            working days or 7 with a Quote. A refusal on time is on time; an
            organiser's cancellation or an expiry is not scored. The caption
            says "within target" because the target differs per booking. */}
        <KpiTile
          label="Decided on time"
          value={isLoading ? <Skeleton className="h-7 w-16" /> : error ? "—" : formatRate(decidedOnTime.compliancePct)}
          caption={
            isLoading || error
              ? undefined
              : decidedOnTime.scored === 0
                ? "Nothing decided in range"
                : `${decidedOnTime.onTime.toLocaleString()} of ${decidedOnTime.scored.toLocaleString()} within target · ${formatTargetGap(decidedOnTime.gapToTargetPts)}`
          }
          note={isLoading ? <Skeleton className="h-3 w-24" /> : error || !compare ? undefined : decidedOnTime.delta}
          direction="higher-is-better"
          noteTone="negative"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Names the ACTIVE range — it used to read a fixed "this month"
            while the panel below was fed `filtered`. See the same note on
            the Incident Reports page's Category mix panel. */}
        <MixBarCard
          title="Event type mix"
          subtitle={`Share of bookings · ${rangeLabel}`}
          slices={eventTypeMixSlices.map((slice) => {
            const label = eventTypeLabel(slice.type);
            return {
              label,
              count: slice.count,
              chipClass: getEventTypeChipClasses(label),
              // Keyed on slice.type (the raw event_type_code), not on the
              // joined label — the label is editable catalog data, the code
              // is the stable identity. See src/portals/admin/lib/status-colors.ts.
              barClass: getEventTypeBarClass(slice.type),
            };
          })}
        />
        <MonthlyBarCard
          title="Bookings by month"
          subtitle={MONTHLY_SUBTITLE[dateBasis]}
          months={monthlyBookings}
        />
      </div>

      <VenueRequestsCard venues={venueRequests} subtitle={rangeLabel} />

      <section className="rounded-none border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent bookings</h2>
          <Button variant="secondary" onClick={handleExportBookings} disabled={!canExport}>
            ↓ Export
          </Button>
        </div>
        <div className="mt-2">
          <Tabs
            tabs={STATUS_TABS.map((tab) => tab.label)}
            active={STATUS_TABS.find((tab) => tab.value === activeTab)?.label ?? "All"}
            onChange={(label) => {
              const match = STATUS_TABS.find((tab) => tab.label === label);
              if (match) setActiveTab(match.value);
            }}
          />
        </div>
        {slaFilter && <SlaRowFilterBanner filter={slaFilter} noun="bookings" onClear={clearSlaFilter} />}

        {isLoading ? (
          <div className="space-y-2 px-6 py-8">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 px-6 py-8 text-center text-sm text-red-700">
            <p>
              {error.kind === "permission"
                ? "You do not have permission to view Convention Center bookings."
                : `Unable to load bookings: ${error.message}`}
            </p>
            <Button variant="secondary" onClick={handleRetry}>
              Retry
            </Button>
          </div>
        ) : tableRows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-500">No bookings match this filter.</p>
        ) : (
          <DataTable
            columns={[
              { header: "Reference", render: (row: BookingRow) => row.reference_number ?? "—" },
              { header: "Event", render: (row: BookingRow) => row.event_title ?? "—" },
              { header: "Venue", render: (row: BookingRow) => venueLabel(row.venue_code) },
              { header: "Event date", render: (row: BookingRow) => formatManilaDate(row.event_date) },
              {
                header: "Status",
                render: (row: BookingRow) => (
                  <Badge status={statusLabel(row.status)} variant={statusVariant(row.status)} />
                ),
              },
              {
                header: "Cancellation Reason",
                render: (row: BookingRow) => cancellationReasonLabel(row.cancellation_reason),
              },
              {
                header: "Review",
                render: (row: BookingRow) => (
                  <Button variant="secondary" onClick={() => setReviewingId(row.id)}>
                    Review
                  </Button>
                ),
              },
            ]}
            rows={tableRows}
            rowKey={(row) => row.id ?? row.reference_number ?? ""}
          />
        )}
      </section>

      <BookingReviewModal bookingId={reviewingId} onClose={() => setReviewingId(null)} />
    </div>
  );
}
