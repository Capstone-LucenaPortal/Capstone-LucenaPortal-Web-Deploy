"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/portals/super-staff/components/ui/badge";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Input } from "@/portals/super-staff/components/ui/input";
import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import { AddMaintenanceModal } from "./add-maintenance-modal";
import { CatalogCard, CatalogRow, RetireCell, TextCell } from "./catalog-card";
import { ConfigTabRail } from "./config-tab-rail";
import { ImpactNote } from "./impact-note";
import { useCatalogEditor } from "../hooks/use-catalog-editor";
import { toUpdateMaintenancePeriodArgs } from "../lib/maintenance-args";
import { maintenanceErrorMessage } from "../lib/maintenance-errors";
import { listMaintenancePeriods, listSpaceStates } from "../lib/maintenance-queries";
import type { MaintenancePeriod, SpaceState, SpaceStateKind } from "../lib/maintenance-types";
import { validateMaintenancePeriod } from "../lib/validation";

// ── Module scope — see the note in use-catalog-editor ──────────────────────
const byId = (p: MaintenancePeriod) => p.id;

const NOT_PERMITTED =
  "Not permitted — only an active Super Staff member can see maintenance.";

const BOOKING_NOTE =
  "A Space under maintenance can't be booked on any Venue that uses it, the Full Facility included. Adding, extending or reactivating a period over days a Booking already holds is refused: cancel or move those Bookings first.";

async function commitPeriod(p: MaintenancePeriod): Promise<void> {
  await callRpc("update_maintenance_period", toUpdateMaintenancePeriodArgs(p));
}

/** The label a period's cells derive their aria-labels from. */
const rowKeyOf = (p: MaintenancePeriod) => `${p.spaceLabel} ${p.firstDay}`;

const STATE_BADGE: Record<
  SpaceStateKind,
  { label: string; variant: "success" | "info" | "warning" }
> = {
  available: { label: "Available", variant: "success" },
  reserved: { label: "Reserved", variant: "info" },
  under_maintenance: { label: "Under Maintenance", variant: "warning" },
};

/** One line per Space: what it is doing today (user story 15). */
function SpaceStateLines({ spaces }: { spaces: SpaceState[] }) {
  return (
    <ul className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-4 text-sm">
      {spaces.map((s) => {
        const badge = STATE_BADGE[s.state];
        return (
          <li key={s.spaceCode} aria-label={s.spaceLabel} className="flex flex-wrap items-center gap-2">
            <span className="w-16 font-medium text-gray-900">{s.spaceLabel}</span>
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {s.state === "under_maintenance" && (
              <span className="text-gray-600">
                until <span className="font-mono text-xs">{s.maintenanceLastDay}</span>
                {s.maintenanceReason && <> &middot; {s.maintenanceReason}</>}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function LastDayCell({
  rowKey,
  value,
  error,
  onChange,
}: {
  rowKey: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <td className="px-4 py-2">
      <Input
        aria-label={`${rowKey} last day`}
        type="date"
        className="w-40"
        value={value}
        error={error}
        onChange={(e) => onChange(e.target.value)}
      />
    </td>
  );
}

export function MaintenanceView() {
  const [spaces, setSpaces] = useState<SpaceState[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(true);
  const [spacesError, setSpacesError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Space State is worked out on every read, so any write that closes or
  // reopens today can change it: the card rereads it after each one.
  const loadSpaces = useCallback(() => {
    listSpaceStates()
      .then((fresh) => {
        setSpaces(fresh);
        setSpacesError(null);
      })
      .catch((e: unknown) =>
        setSpacesError(maintenanceErrorMessage(e, "Could not load the Spaces' state.")),
      )
      .finally(() => setSpacesLoading(false));
  }, []);

  useEffect(loadSpaces, [loadSpaces]);

  const periods = useCatalogEditor<MaintenancePeriod>({
    load: listMaintenancePeriods,
    commit: commitPeriod,
    validate: validateMaintenancePeriod,
    keyOf: byId,
    label: "Maintenance Periods",
    errorMessage: maintenanceErrorMessage,
    onSaved: loadSpaces,
  });

  // The access signal for the screen. Both views share one gate and a definer
  // view answers a refused gate with zero rows, not an error. Both Spaces are
  // seeded, so no Spaces means "not permitted" — while an empty period list
  // alone is just a city that has closed nothing yet.
  const refused = !spacesLoading && !spacesError && spaces.length === 0;

  const onAdded = () => {
    void periods.reload().catch(() => undefined);
    loadSpaces();
  };

  return (
    <div className="pb-24">
      <div>
        <h1 className="text-3xl font-bold text-lucena-blue">Configuration</h1>
        <p className="text-gray-500 mt-2">
          Close a Space for repair, and see what each Space is doing today.
        </p>
      </div>

      <div className="mt-6">
        <ConfigTabRail dirty={periods.dirtyKeys.size > 0} />
      </div>

      <ImpactNote>{BOOKING_NOTE}</ImpactNote>

      <div className="mt-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="mb-2 text-sm font-medium text-gray-500">Today</h2>
            {spacesLoading ? (
              <p className="text-sm text-gray-500">Loading&hellip;</p>
            ) : spacesError ? (
              <p className="text-sm text-red-500">{spacesError}</p>
            ) : refused ? (
              <p className="text-sm text-red-500">{NOT_PERMITTED}</p>
            ) : (
              <SpaceStateLines spaces={spaces} />
            )}
          </div>
          {!spacesLoading && !refused && !spacesError && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              Add Maintenance Period
            </Button>
          )}
        </div>

        <CatalogCard
          title="Maintenance Periods"
          rowCount={periods.rows.length}
          headers={["Space", "First day", "Last day", "Reason", "Active"]}
          loading={periods.loading}
          error={refused ? NOT_PERMITTED : periods.error}
          note="Both days are included, in Manila dates. Retired periods stay listed so they can be reactivated; reactivating checks for Bookings again. The first day can't be changed: to fix a wrong start, retire the period and add a new one."
        >
          {periods.rows.map((p) => {
            const rowKey = rowKeyOf(p);
            const errors = periods.rowErrors[p.id];
            return (
              <CatalogRow
                key={p.id}
                isActive={p.isActive}
                dirty={periods.dirtyKeys.has(p.id)}
                saving={periods.savingKey === p.id}
                onSave={() => void periods.save(p.id)}
                onRevert={() => periods.revert(p.id)}
                refusal={periods.rowRefusals[p.id]}
              >
                <td className="px-4 py-2 font-medium">{p.spaceLabel}</td>
                <td className="px-4 py-2 whitespace-nowrap font-mono text-xs">{p.firstDay}</td>
                <LastDayCell
                  rowKey={rowKey}
                  value={p.lastDay}
                  error={errors?.lastDay}
                  onChange={(lastDay) => periods.update(p.id, { lastDay })}
                />
                <TextCell
                  rowKey={rowKey}
                  field="reason"
                  value={p.reason}
                  errors={errors}
                  onChange={(reason) => periods.update(p.id, { reason })}
                />
                <RetireCell
                  rowKey={rowKey}
                  checked={p.isActive}
                  onChange={(isActive) => periods.update(p.id, { isActive })}
                />
              </CatalogRow>
            );
          })}
        </CatalogCard>
      </div>

      <AddMaintenanceModal
        open={adding}
        spaces={spaces}
        onClose={() => setAdding(false)}
        onAdded={onAdded}
      />
    </div>
  );
}
