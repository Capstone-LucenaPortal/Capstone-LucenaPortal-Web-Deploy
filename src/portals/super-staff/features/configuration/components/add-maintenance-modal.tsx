"use client";

import { useState } from "react";
import { useToast } from "@/portals/super-staff/components/providers/toast-provider";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Input } from "@/portals/super-staff/components/ui/input";
import { Modal } from "@/portals/super-staff/components/ui/modal";
import { Select } from "@/portals/super-staff/components/ui/select";
import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import { toAddMaintenancePeriodArgs } from "../lib/maintenance-args";
import { maintenanceErrorMessage } from "../lib/maintenance-errors";
import type { NewMaintenancePeriod, SpaceState } from "../lib/maintenance-types";
import { validateNewMaintenancePeriod, type ConfigErrors } from "../lib/validation";

const EMPTY: NewMaintenancePeriod = { spaceCode: "", firstDay: "", lastDay: "", reason: "" };

/**
 * Put a Space Under Maintenance for a run of whole days. The Space and the
 * first day are only ever set here: an edit cannot change them, so a wrong
 * start is retired and a new period added.
 *
 * A refused save keeps the dialog open with the reason inside it. The likeliest
 * refusal is the clash with Bookings, whose message lists the references the
 * city must cancel or move first.
 */
export function AddMaintenanceModal({
  open,
  spaces,
  onClose,
  onAdded,
}: {
  open: boolean;
  /** The Spaces to choose from — the Space State lines already list them. */
  spaces: Pick<SpaceState, "spaceCode" | "spaceLabel">[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<NewMaintenancePeriod>(EMPTY);
  const [errors, setErrors] = useState<ConfigErrors>({});
  const [refusal, setRefusal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The Spaces load after this mounts, so the default is read at use, not
  // frozen into the initial draft.
  const spaceCode = draft.spaceCode || (spaces[0]?.spaceCode ?? "");

  const close = () => {
    setDraft(EMPTY);
    setErrors({});
    setRefusal(null);
    onClose();
  };

  const update = (patch: Partial<NewMaintenancePeriod>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors({});
    setRefusal(null);
  };

  const submit = async () => {
    const period = { ...draft, spaceCode };
    const found = validateNewMaintenancePeriod(period);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setSaving(true);
    try {
      await callRpc("add_maintenance_period", toAddMaintenancePeriodArgs(period));
    } catch (e: unknown) {
      setRefusal(maintenanceErrorMessage(e, "Could not add the Maintenance Period. Try again."));
      setSaving(false);
      return;
    }
    setSaving(false);
    toast("Maintenance Period added.", "success");
    close();
    onAdded();
  };

  return (
    <Modal open={open} onClose={saving ? undefined : close}>
      <h3 className="text-lg font-semibold text-gray-900">Add Maintenance Period</h3>
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="maintenance-space" className="text-sm font-medium text-gray-900">
            Space
          </label>
          <Select
            id="maintenance-space"
            value={spaceCode}
            onChange={(e) => update({ spaceCode: e.target.value })}
          >
            {spaces.map((s) => (
              <option key={s.spaceCode} value={s.spaceCode}>
                {s.spaceLabel}
              </option>
            ))}
          </Select>
          {errors.spaceCode && <p className="text-xs text-red-500">{errors.spaceCode}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="maintenance-first-day" className="text-sm font-medium text-gray-900">
              First day
            </label>
            <Input
              id="maintenance-first-day"
              type="date"
              value={draft.firstDay}
              error={errors.firstDay}
              onChange={(e) => update({ firstDay: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="maintenance-last-day" className="text-sm font-medium text-gray-900">
              Last day
            </label>
            <Input
              id="maintenance-last-day"
              type="date"
              value={draft.lastDay}
              error={errors.lastDay}
              onChange={(e) => update({ lastDay: e.target.value })}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="maintenance-reason" className="text-sm font-medium text-gray-900">
            Reason
          </label>
          <Input
            id="maintenance-reason"
            maxLength={500}
            placeholder="e.g. Aircon repair"
            value={draft.reason}
            error={errors.reason}
            onChange={(e) => update({ reason: e.target.value })}
          />
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-600">
        Both days are included. The Space can&rsquo;t be booked on any Venue that uses it from the
        first day to the last. Staff see the reason; Citizens don&rsquo;t.
      </p>

      {refusal && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
          {refusal}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={close} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => void submit()} disabled={saving}>
          {saving ? "Adding…" : "Add Maintenance Period"}
        </Button>
      </div>
    </Modal>
  );
}
