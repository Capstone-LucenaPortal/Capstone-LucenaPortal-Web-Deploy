"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/portals/super-staff/components/ui/badge";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Input } from "@/portals/super-staff/components/ui/input";
import { Select } from "@/portals/super-staff/components/ui/select";
import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import { cn } from "@/portals/super-staff/lib/utils";
import { AddHolidayModal } from "./add-holiday-modal";
import { DEADLINE_NOTE, HOLIDAY_KINDS } from "./calendar-copy";
import { CatalogCard, CatalogRow, ReservedBadge, TextCell } from "./catalog-card";
import { ConfigTabRail } from "./config-tab-rail";
import { ImpactNote } from "./impact-note";
import { useCatalogEditor } from "../hooks/use-catalog-editor";
import { toOfficeHoursArgs, toUpdateHolidayArgs } from "../lib/calendar-args";
import { calendarErrorMessage } from "../lib/calendar-errors";
import { calendarHorizon, manilaToday } from "../lib/calendar-horizon";
import { getCalendarEndsOn, listHolidays, listOfficeHours } from "../lib/calendar-queries";
import type { Holiday, HolidayKind, OfficeHours } from "../lib/calendar-types";
import { validateHoliday, validateOfficeHours, type ConfigErrors } from "../lib/validation";

// ── Module scope — see the note in use-catalog-editor ──────────────────────
const byId = (h: Holiday) => h.id;
const byWeekday = (d: OfficeHours) => String(d.isoWeekday);

const NOT_PERMITTED =
  "Not permitted — only an active Super Staff member can see the calendar.";

async function commitHoliday(h: Holiday): Promise<void> {
  await callRpc("update_holiday", toUpdateHolidayArgs(h));
}

async function commitOfficeHours(d: OfficeHours): Promise<void> {
  await callRpc("set_office_hours", toOfficeHoursArgs(d));
}

/** `2027-12-31` → `31 December 2027`. Read as a calendar date, not an instant. */
const longDate = (d: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${d}T00:00:00Z`));

/**
 * How far ahead the calendar reaches (user story 15). Past that date every
 * weekday silently becomes a Working Day, so the warning escalates as it
 * approaches rather than waiting for it to pass.
 */
function HorizonNotice({ endsOn }: { endsOn: string | null }) {
  const h = calendarHorizon(endsOn, manilaToday());
  const consequence =
    "after it, every weekday counts as a Working Day and deadlines come due too early.";

  if (h.state === "none") {
    return (
      <p role="status" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
        There are no active holidays, so the calendar covers no dates at all. Add this
        year&rsquo;s holidays.
      </p>
    );
  }
  const ends = longDate(endsOn!);
  if (h.state === "ok") {
    return (
      <p className="text-sm text-gray-600">
        The holiday calendar covers dates up to <strong>{ends}</strong>.
      </p>
    );
  }
  return (
    <p
      role="status"
      className={cn(
        "rounded-md p-3 text-sm",
        h.state === "passed" ? "bg-red-50 text-red-800" : "bg-yellow-50 text-yellow-800",
      )}
    >
      {h.state === "passed"
        ? `The holiday calendar ended on ${ends}, ${-h.daysLeft} days ago. `
        : `The holiday calendar ends on ${ends}, in ${h.daysLeft} days. `}
      Add next year&rsquo;s holidays: {consequence}
    </p>
  );
}

function KindCell({
  rowKey,
  value,
  onChange,
}: {
  rowKey: string;
  value: HolidayKind;
  onChange: (kind: HolidayKind) => void;
}) {
  return (
    <td className="px-4 py-2">
      <Select
        aria-label={`${rowKey} kind`}
        value={value}
        onChange={(e) => onChange(e.target.value as HolidayKind)}
      >
        {HOLIDAY_KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </Select>
    </td>
  );
}

/** Retire / reactivate. There is no delete: a retired holiday stays listed. */
function HolidayActiveCell({
  rowKey,
  checked,
  onChange,
}: {
  rowKey: string;
  checked: boolean;
  onChange: (isActive: boolean) => void;
}) {
  return (
    <td className="px-4 py-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          aria-label={`${rowKey} active`}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-lucena-blue"
        />
        <ReservedBadge shown={!checked}>
          <Badge variant="default">Retired</Badge>
        </ReservedBadge>
      </label>
    </td>
  );
}

function TimeCell({
  label,
  value,
  disabled,
  error,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <td className="px-4 py-2">
      {/* Text, not type="time": a time input cannot hold 24:00, which is a
          legal close meaning end of day. */}
      <Input
        aria-label={label}
        inputMode="numeric"
        placeholder="HH:MM"
        className="w-24"
        value={value}
        disabled={disabled}
        error={error}
        onChange={(e) => onChange(e.target.value)}
      />
    </td>
  );
}

export function CalendarView() {
  const [endsOn, setEndsOn] = useState<string | null | undefined>(undefined);
  const [adding, setAdding] = useState(false);

  const loadHorizon = useCallback(() => {
    getCalendarEndsOn()
      .then(setEndsOn)
      .catch(() => setEndsOn(undefined));
  }, []);

  useEffect(loadHorizon, [loadHorizon]);

  const holidays = useCatalogEditor<Holiday>({
    load: listHolidays,
    commit: commitHoliday,
    validate: validateHoliday,
    keyOf: byId,
    label: "holidays",
    errorMessage: calendarErrorMessage,
    onSaved: loadHorizon,
  });

  const officeHours = useCatalogEditor<OfficeHours>({
    load: listOfficeHours,
    commit: commitOfficeHours,
    validate: validateOfficeHours,
    keyOf: byWeekday,
    label: "Office Hours",
    errorMessage: calendarErrorMessage,
  });

  // The access signal for the whole screen. A definer view answers a refused
  // gate with zero rows, not an error, and both views share one gate. All
  // seven weekdays are seeded, so an empty week means "not permitted" — while
  // an empty holiday list alone could be a genuinely empty calendar, and must
  // not be read either way on its own.
  const refused = !officeHours.loading && !officeHours.error && officeHours.rows.length === 0;

  const onAdded = () => {
    void holidays.reload().catch(() => undefined);
    loadHorizon();
  };

  const anyDirty = holidays.dirtyKeys.size > 0 || officeHours.dirtyKeys.size > 0;
  const holidayErrors = (id: string): ConfigErrors | undefined => holidays.rowErrors[id];

  return (
    <div className="pb-24">
      <div>
        <h1 className="text-3xl font-bold text-lucena-blue">Configuration</h1>
        <p className="text-gray-500 mt-2">
          Holidays and Office Hours decide which hours count as Working Time.
        </p>
      </div>

      <div className="mt-6">
        <ConfigTabRail dirty={anyDirty} />
      </div>

      <ImpactNote>{DEADLINE_NOTE}</ImpactNote>

      <div className="mt-6 space-y-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {endsOn !== undefined && !officeHours.loading && !refused && (
                <HorizonNotice endsOn={endsOn} />
              )}
            </div>
            {!refused && (
              <Button variant="primary" onClick={() => setAdding(true)}>
                Add holiday
              </Button>
            )}
          </div>

          <CatalogCard
            title="Holidays"
            rowCount={holidays.rows.length}
            headers={["Date", "Name", "Kind", "Source", "Active"]}
            loading={holidays.loading}
            error={refused ? NOT_PERMITTED : holidays.error}
            note="Retired holidays stay listed so they can be reactivated. A holiday on the wrong date is retired and the right date added."
          >
            {holidays.rows.map((h) => (
              <CatalogRow
                key={h.id}
                isActive={h.isActive}
                dirty={holidays.dirtyKeys.has(h.id)}
                saving={holidays.savingKey === h.id}
                onSave={() => void holidays.save(h.id)}
                onRevert={() => holidays.revert(h.id)}
              >
                <td className="px-4 py-2 whitespace-nowrap font-mono text-xs">
                  {h.holidayDate}
                </td>
                <TextCell
                  rowKey={h.holidayDate}
                  field="name"
                  value={h.name}
                  errors={holidayErrors(h.id)}
                  onChange={(name) => holidays.update(h.id, { name })}
                />
                <KindCell
                  rowKey={h.holidayDate}
                  value={h.kind}
                  onChange={(kind) => holidays.update(h.id, { kind })}
                />
                <TextCell
                  rowKey={h.holidayDate}
                  field="source"
                  value={h.source}
                  errors={holidayErrors(h.id)}
                  onChange={(source) => holidays.update(h.id, { source })}
                />
                <HolidayActiveCell
                  rowKey={h.holidayDate}
                  checked={h.isActive}
                  onChange={(isActive) => holidays.update(h.id, { isActive })}
                />
              </CatalogRow>
            ))}
          </CatalogCard>
        </div>

        <CatalogCard
          title="Office Hours"
          rowCount={officeHours.rows.length}
          headers={["Day", "Open", "Opens", "Closes"]}
          loading={officeHours.loading}
          error={refused ? NOT_PERMITTED : officeHours.error}
          note="Manila time. A day with no Office Hours is not a Working Day. Use 24:00 for a close at the end of the day. This does not change the office hours text shown to citizens."
        >
          {officeHours.rows.map((d) => {
            const key = byWeekday(d);
            const errors = officeHours.rowErrors[key];
            return (
              <CatalogRow
                key={key}
                isActive={d.open}
                dirty={officeHours.dirtyKeys.has(key)}
                saving={officeHours.savingKey === key}
                onSave={() => void officeHours.save(key)}
                onRevert={() => officeHours.revert(key)}
              >
                <td className="px-4 py-2 font-medium">{d.dayName}</td>
                <td className="px-4 py-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      aria-label={`${d.dayName} open`}
                      checked={d.open}
                      onChange={(e) => officeHours.update(key, { open: e.target.checked })}
                      className="h-4 w-4 accent-lucena-blue"
                    />
                    <ReservedBadge shown={!d.open}>
                      <Badge variant="default">Closed</Badge>
                    </ReservedBadge>
                  </label>
                </td>
                <TimeCell
                  label={`${d.dayName} opens`}
                  value={d.openTime}
                  disabled={!d.open}
                  error={errors?.openTime}
                  onChange={(openTime) => officeHours.update(key, { openTime })}
                />
                <TimeCell
                  label={`${d.dayName} closes`}
                  value={d.closeTime}
                  disabled={!d.open}
                  error={errors?.closeTime}
                  onChange={(closeTime) => officeHours.update(key, { closeTime })}
                />
              </CatalogRow>
            );
          })}
        </CatalogCard>
      </div>

      <AddHolidayModal open={adding} onClose={() => setAdding(false)} onAdded={onAdded} />
    </div>
  );
}
