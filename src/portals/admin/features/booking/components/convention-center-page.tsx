// src/portals/admin/features/booking/components/convention-center-page.tsx
"use client";


import { useEffect, useMemo, useState } from "react";
import {
  conventionDateAccessor,
  conventionRangeStats,
  eventTypeMix,
  recentMonthlyCounts,
  venueUtilisation,
} from "@/portals/admin/lib/aggregate";
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
import { BookingOriginsTable } from "@/portals/admin/features/booking/components/booking-origins-table";
import { VenueUtilizationCard } from "@/portals/admin/features/booking/components/venue-utilization-card";
import { BookingReviewModal } from "@/portals/admin/features/booking/components/booking-review-modal";
import { getBookingStatusVariant, getEventTypeBarClass, getEventTypeChipClasses } from "@/portals/admin/lib/status-colors";
import {
  BOOKING_CANCELLATION_REASON_LABELS,
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_ORDER,
  BookingStatusValue,
} from "@/portals/admin/lib/status-labels";
import { downloadCsv } from "@/portals/admin/lib/csv";

const BASIS_OPTIONS: { value: ConventionDateBasis; label: string }[] = [
  { value: "booking", label: "Booking Date" },
  { value: "event", label: "Event Date" },
];

// The monthly chart's subtitle names the date the picked date type reads. The
// default (submitted) date type keeps the subtitle as it always was. The
// table's "Event date" column stays under both date types.
const MONTHLY_SUBTITLE: Record<ConventionDateBasis, string> = {
  booking: "Last 6 months",
  event: "By event date · Last 6 months",
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
  const [preset, setPreset] = useState<DateFilterPreset>("Month");
  // Seeded from the current Manila month rather than from literals written
  // the day this page was authored — see the yellow-card page for the same
  // note. Lazy initialisers, so presetDateRange runs once on mount.
  const [customStart, setCustomStart] = useState(() => presetDateRange("Month").from);
  const [customEnd, setCustomEnd] = useState(() => presetDateRange("Month").to);
  const [dateBasis, setDateBasis] = useState<ConventionDateBasis>("booking");
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
  const filtered = useMemo(
    () => filterByDateRange(filterRows(rows, activeTab), getDate, dateRange),
    [rows, activeTab, getDate, dateRange]
  );

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
  // venueUtilisation intentionally stays on raw `rows` too (not `filtered`):
  // it's driven by the full venue catalog via listVenues(), not by which
  // codes happen to appear in the current filter, and was not part of Fix
  // round 1's scope.
  const venueBookingsData = useMemo(() => venueUtilisation(rows, venues), [rows, venues]);

  // The CSV carries no organiser PII — every column here also appears in the
  // visible table — so it reads the already-filtered `rows` state directly
  // rather than going through the audited readBookingPii RPC (contrast with
  // Yellow Card's exportApplications, which releases applicant identity and
  // must be audited).
  function handleExportBookings() {
    downloadCsv(
      "convention-center-bookings.csv",
      ["Reference", "Event", "Venue", "Event date", "Status", "Cancellation Reason"],
      filtered.map((row) => [
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
      <PageHero title="Convention Center Bookings" subtitle="Utilization and resident vs outside Lucena breakdown" image="/perez-park.webp">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Bookings"
          value={isLoading ? <Skeleton className="h-7 w-16" /> : error ? "—" : stats.bookings.toLocaleString()}
          note={isLoading ? <Skeleton className="h-3 w-24" /> : error || !compare ? undefined : stats.bookingsDelta}
          noteTone="positive"
        />
        {/* Utilization states its own gap instead of showing a fabricated
            fill rate: public_booking_venues.capacity_label is free text
            ("1000 classroom / 500 table"), not a number to divide bookings
            by — the same gap VenueUtilizationCard's avgFillPct already
            renders as "no cap tracking" per venue. See
            src/portals/admin/lib/aggregate.ts's conventionRangeStats doc comment. */}
        <KpiTile
          label="Utilization"
          value="Not tracked"
          note="No venue capacity figure to divide bookings by"
          noteTone="neutral"
        />
        {/* Resident Share states its own gap instead of showing a fabricated
            number: submit_booking never writes origin_barangay_code or
            origin_locality, so origin_barangay_code is always null and the
            generated is_resident column (origin_barangay_code is not null)
            always evaluates to false, not null — there is still no real
            resident-share figure to report. See BookingOriginsTable below
            for the fuller explanation of the same gap. */}
        <KpiTile
          label="Resident Share"
          value="Not tracked"
          note="submit_booking does not capture residency yet"
          noteTone="neutral"
        />
        {/* Outside Lucena is the mirror of Resident Share above — same
            missing origin data, same honest gap rather than a fabricated
            percentage. */}
        <KpiTile
          label="Outside Lucena"
          value="Not tracked"
          note="submit_booking does not capture residency yet"
          noteTone="neutral"
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

      <VenueUtilizationCard venues={venueBookingsData} />

      <BookingOriginsTable bookings={filtered} />

      <section className="rounded-none border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent bookings</h2>
          <Button variant="secondary" onClick={handleExportBookings}>
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
        ) : filtered.length === 0 ? (
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
            rows={filtered}
            rowKey={(row) => row.id ?? row.reference_number ?? ""}
          />
        )}
      </section>

      <BookingReviewModal bookingId={reviewingId} onClose={() => setReviewingId(null)} />
    </div>
  );
}
