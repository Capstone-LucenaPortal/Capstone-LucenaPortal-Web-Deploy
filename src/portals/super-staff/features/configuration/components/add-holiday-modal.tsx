"use client";

import { useState } from "react";
import { useToast } from "@/portals/super-staff/components/providers/toast-provider";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Input } from "@/portals/super-staff/components/ui/input";
import { Modal } from "@/portals/super-staff/components/ui/modal";
import { Select } from "@/portals/super-staff/components/ui/select";
import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import { toAddHolidayArgs } from "../lib/calendar-args";
import { calendarErrorMessage } from "../lib/calendar-errors";
import type { NewHoliday } from "../lib/calendar-types";
import { validateNewHoliday, type ConfigErrors } from "../lib/validation";
import { DEADLINE_NOTE, HOLIDAY_KINDS } from "./calendar-copy";

const EMPTY: NewHoliday = { holidayDate: "", name: "", kind: "regular", source: "" };

/**
 * Declare a Holiday — or a suspension of work at 7 a.m., which is the case
 * this exists for (user story 10). The date is only ever set here: an edit
 * cannot move it, so a wrong date is retired and the right one added.
 *
 * A refused save keeps the dialog open with the database's reason inside it.
 * The likeliest refusal is 23505, a date that already has an entry — possibly
 * a RETIRED one, whose message says to reactivate it instead.
 */
export function AddHolidayModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<NewHoliday>(EMPTY);
  const [errors, setErrors] = useState<ConfigErrors>({});
  const [refusal, setRefusal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setDraft(EMPTY);
    setErrors({});
    setRefusal(null);
    onClose();
  };

  const update = (patch: Partial<NewHoliday>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors({});
    setRefusal(null);
  };

  const submit = async () => {
    const found = validateNewHoliday(draft);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setSaving(true);
    try {
      await callRpc("add_holiday", toAddHolidayArgs(draft));
    } catch (e: unknown) {
      setRefusal(calendarErrorMessage(e, "Could not add the holiday. Try again."));
      setSaving(false);
      return;
    }
    setSaving(false);
    toast("Holiday added.", "success");
    close();
    onAdded();
  };

  return (
    <Modal open={open} onClose={saving ? undefined : close}>
      <h3 className="text-lg font-semibold text-gray-900">Add holiday</h3>
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="holiday-date" className="text-sm font-medium text-gray-900">
            Date
          </label>
          <Input
            id="holiday-date"
            type="date"
            value={draft.holidayDate}
            error={errors.holidayDate}
            onChange={(e) => update({ holidayDate: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="holiday-name" className="text-sm font-medium text-gray-900">
            Name
          </label>
          <Input
            id="holiday-name"
            maxLength={120}
            value={draft.name}
            error={errors.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="holiday-kind" className="text-sm font-medium text-gray-900">
            Kind
          </label>
          <Select
            id="holiday-kind"
            value={draft.kind}
            onChange={(e) => update({ kind: e.target.value as NewHoliday["kind"] })}
          >
            {HOLIDAY_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="holiday-source" className="text-sm font-medium text-gray-900">
            Source
          </label>
          <Input
            id="holiday-source"
            maxLength={200}
            placeholder="e.g. Proclamation No. 727, s. 2024"
            value={draft.source}
            error={errors.source}
            onChange={(e) => update({ source: e.target.value })}
          />
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-600">{DEADLINE_NOTE}</p>

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
          {saving ? "Adding…" : "Add holiday"}
        </Button>
      </div>
    </Modal>
  );
}
