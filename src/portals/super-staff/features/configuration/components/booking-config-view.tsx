"use client";

import { Button } from "@/portals/super-staff/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/portals/super-staff/components/ui/card";
import { Input, numValue } from "@/portals/super-staff/components/ui/input";
import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import {
  ClassificationsCard,
  EventTypesCard,
  VenuesCard,
} from "./booking-catalogs";
import { ConfigLoadState } from "./config-load-state";
import { ConfigTabRail } from "./config-tab-rail";
import { DiffConfirmModal } from "./diff-confirm-modal";
import { ImpactNote } from "./impact-note";
import {
  useClassificationsEditor,
  useEventTypesEditor,
  useVenuesEditor,
} from "../hooks/use-catalog-editors";
import { useConfigEditor } from "../hooks/use-config-editor";
import { toBookingConfigArgs } from "../lib/config-args";
import { diffBooking } from "../lib/diff";
import { bookingImpact } from "../lib/impact";
import { getBookingConfig } from "../lib/queries";
import { validateBooking } from "../lib/validation";
import type { BookingConfig } from "../types";

const SNAPSHOT_NOTE = "Applies to bookings created after this change.";

/**
 * Module scope, not an inline closure: the editor's load effect depends on the
 * identity of these functions and would re-fetch forever if they changed each
 * render. Refetching rather than trusting the returned row keeps one mapping
 * path and survives a column the portal does not model.
 */
async function commitBooking(after: BookingConfig): Promise<BookingConfig> {
  await callRpc("save_booking_config", toBookingConfigArgs(after));
  return getBookingConfig();
}

export function BookingConfigView() {
  const {
    draft,
    saved,
    update,
    errors,
    changes,
    dirty,
    confirmOpen,
    setConfirmOpen,
    saving,
    requestSave,
    confirmSave,
    reset,
    error,
  } = useConfigEditor({
    load: getBookingConfig,
    diff: diffBooking,
    validate: validateBooking,
    commit: commitBooking,
    moduleLabel: "Booking",
  });

  // Called before the early return — hooks cannot be conditional.
  const venues = useVenuesEditor();
  const eventTypes = useEventTypesEditor();
  const classifications = useClassificationsEditor();

  // A tab is dirty if the scalar form is dirty OR any catalog row is. The
  // rail's limitation is unchanged: it guards tab-to-tab navigation and
  // beforeunload, but does NOT intercept sidebar <Link> navigation — App
  // Router exposes no hook for that.
  const anyDirty =
    dirty ||
    venues.dirtyKeys.size > 0 ||
    eventTypes.dirtyKeys.size > 0 ||
    classifications.dirtyKeys.size > 0;

  if (!draft || !saved) {
    return <ConfigLoadState error={error} />;
  }

  const impact = bookingImpact(saved, draft);

  return (
    <div className="pb-24">
      <div>
        <h1 className="text-3xl font-bold text-lucena-blue">Configuration</h1>
        <p className="text-gray-500 mt-2">
          Edit business-rule constants. Changes apply to new records only.
        </p>
      </div>

      <div className="mt-6">
        <ConfigTabRail dirty={anyDirty} />
      </div>

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Financial Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid max-w-md grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="downpayment"
                  className="text-sm font-medium text-gray-900"
                >
                  Downpayment (%)
                </label>
                <Input
                  id="downpayment"
                  type="number"
                  min={0}
                  max={100}
                  value={numValue(draft.downpaymentPct)}
                  error={errors.downpayment}
                  onChange={(e) => update({ downpaymentPct: e.target.valueAsNumber })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="paymentWindow"
                  className="text-sm font-medium text-gray-900"
                >
                  Payment window (hours)
                </label>
                <Input
                  id="paymentWindow"
                  type="number"
                  min={1}
                  value={numValue(draft.paymentWindowHours)}
                  error={errors.paymentWindow}
                  onChange={(e) =>
                    update({ paymentWindowHours: e.target.valueAsNumber })
                  }
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Downpayment is the GCash prepayment to confirm a booking; the balance
              is paid in person. An unpaid hold is swept once the payment window
              elapses.
            </p>
            <ImpactNote>{impact.financial}</ImpactNote>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Facility Hours and Holds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="openingHour"
                  className="text-sm font-medium text-gray-900"
                >
                  Opening hour
                </label>
                <Input
                  id="openingHour"
                  type="number"
                  min={0}
                  max={23}
                  value={numValue(draft.openingHour)}
                  error={errors.openingHour}
                  onChange={(e) => update({ openingHour: e.target.valueAsNumber })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="closingHour"
                  className="text-sm font-medium text-gray-900"
                >
                  Closing hour
                </label>
                <Input
                  id="closingHour"
                  type="number"
                  min={0}
                  max={23}
                  value={numValue(draft.closingHour)}
                  error={errors.closingHour}
                  onChange={(e) => update({ closingHour: e.target.valueAsNumber })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="minDuration"
                  className="text-sm font-medium text-gray-900"
                >
                  Minimum duration (hours)
                </label>
                <Input
                  id="minDuration"
                  type="number"
                  min={1}
                  value={numValue(draft.minDurationHours)}
                  error={errors.minDuration}
                  onChange={(e) =>
                    update({ minDurationHours: e.target.valueAsNumber })
                  }
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              The citizen booking form reads these live.
            </p>
            <ImpactNote>{impact.hours}</ImpactNote>
          </CardContent>
        </Card>

        <VenuesCard editor={venues} />
        <EventTypesCard editor={eventTypes} />
        <ClassificationsCard editor={classifications} />
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 py-4">
        <Button variant="secondary" onClick={reset} disabled={!dirty || saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={requestSave} disabled={!dirty || saving}>
          Save changes
        </Button>
      </div>

      <DiffConfirmModal
        open={confirmOpen}
        moduleLabel="Booking"
        changes={changes}
        snapshotNote={SNAPSHOT_NOTE}
        saving={saving}
        onConfirm={confirmSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
